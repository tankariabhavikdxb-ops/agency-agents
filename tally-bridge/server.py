#!/usr/bin/env python3
"""
Tally Prime 2.1 - Frontend Bridge Middleware  (Phase 1)
=======================================================
Core middleware that bridges the HTML frontend with Tally Prime 2.1.

  * Flask            - HTTP API + static frontend hosting
  * Flask-SocketIO   - real-time push updates to the browser
  * Tally XML API    - read + write (HTTP, default port 9000)
  * Tally ODBC       - optional fast read path (graceful fallback if the
                       pyodbc driver is not installed)

Highlights
----------
  - Bidirectional sync engine (polls Tally ALTER ID, pushes WebSocket events)
  - Hardened XML sanitizer (special chars, unicode, invalid XML chars)
  - Full CRUD for masters (ledgers / stock items) and vouchers
  - Reports: Trial Balance, Day Book, Ledger vouchers, Balance Sheet, P&L
  - Response cache with TTL + memory eviction (protects Tally from hammering)
  - Import requests are NEVER auto-retried (prevents duplicate vouchers)
  - Works with `mock_tally.py` so the whole stack can be developed offline

Run:  python server.py          (then open http://127.0.0.1:5000)
"""

import os
import re
import sys
import json
import time
import queue
import hashlib
import logging
import threading
import unicodedata
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from functools import wraps
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape as xml_escape
import urllib.parse

# Third-party imports -----------------------------------------------------
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# pyodbc is OPTIONAL: the XML API alone covers 100% of functionality.
# ODBC is a faster read path used only when the driver is installed
# (on Windows with Tally Prime running it is installed automatically).
try:
    import pyodbc  # type: ignore
    PYODBC_AVAILABLE = True
except ImportError:  # pragma: no cover
    pyodbc = None
    PYODBC_AVAILABLE = False


# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================
def _build_log_handlers():
    handlers = [logging.StreamHandler(sys.stdout)]
    try:
        handlers.append(logging.FileHandler('tally_bridge.log', encoding='utf-8'))
    except OSError:
        pass  # read-only cwd etc. - console logging is enough
    return handlers


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=_build_log_handlers()
)
logger = logging.getLogger('TallyBridge')


# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================
class Config:
    """Central configuration management (every value overridable by env)."""

    # Flask Settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'tally-bridge-secret-key-2024')
    HOST = os.environ.get('BRIDGE_HOST', '127.0.0.1')
    PORT = int(os.environ.get('BRIDGE_PORT', '5000'))
    DEBUG = os.environ.get('BRIDGE_DEBUG', 'False').lower() == 'true'

    # Tally XML API Settings
    TALLY_HOST = os.environ.get('TALLY_HOST', 'localhost')
    TALLY_PORT = int(os.environ.get('TALLY_PORT', '9000'))
    TALLY_URL = os.environ.get('TALLY_URL', f'http://{TALLY_HOST}:{TALLY_PORT}')

    # ODBC Settings (Tally Prime exposes an ODBC endpoint on the same port)
    ODBC_DSN = os.environ.get('TALLY_ODBC_DSN', 'TallyODBC64_9000')
    # Full connection string override, e.g.:
    #   "Driver={Tally ODBC Driver};Server=192.168.1.10;Port=9000"
    ODBC_CONNECT_STRING = os.environ.get('TALLY_ODBC_CONNECT_STRING', '')

    # Sync Settings
    SYNC_INTERVAL = int(os.environ.get('SYNC_INTERVAL', '5'))       # seconds
    MAX_RECORDS_PER_BATCH = int(os.environ.get('MAX_BATCH', '100'))
    REQUEST_TIMEOUT = int(os.environ.get('REQUEST_TIMEOUT', '30'))  # seconds
    MAX_RETRY_ATTEMPTS = 3
    RETRY_DELAY = 2  # seconds

    # Memory Management
    MAX_CACHE_SIZE_MB = int(os.environ.get('MAX_CACHE_MB', '50'))
    CACHE_TTL_SECONDS = int(os.environ.get('CACHE_TTL', '15'))

    # Concurrency (protect Tally - it is single threaded internally)
    MAX_CONCURRENT_REQUESTS = int(os.environ.get('MAX_CONCURRENT', '5'))

    # Data Sanitization
    MAX_FIELD_LENGTH = 500
    MAX_NARRATION_LENGTH = 1000
    MAX_XML_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def financial_year(today=None):
    """Return (from_date, to_date) YYYYMMDD for the Indian FY (Apr-Mar)."""
    today = today or date.today()
    start_year = today.year if today.month >= 4 else today.year - 1
    return f'{start_year}0401', f'{start_year + 1}0331'


# ============================================================================
# INITIALIZE FLASK APPLICATION
# ============================================================================
app = Flask(__name__, static_folder='frontend', static_url_path='')
app.config.from_object(Config)
app.url_map.strict_slashes = False
CORS(app, resources={r'/api/*': {'origins': '*'}})
socketio = SocketIO(
    app,
    cors_allowed_origins='*',
    async_mode='threading',
    ping_timeout=60,
    ping_interval=25,
)


# ============================================================================
# XML SANITIZATION & SPECIAL CHARACTER HANDLING
# ============================================================================
class XMLSanitizer:
    """
    Comprehensive XML sanitization for Tally compatibility.
    Handles special characters, encoding issues and XML injection.
    """

    # Characters invalid in XML 1.0
    INVALID_XML_CHARS = re.compile(
        '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x84\x86-\x9f'
        '\ufdd0-\ufdef\ufffe\uffff]'
    )

    # Tally uses some control chars as internal delimiters - strip them
    TALLY_DELIMITER_CHARS = ('\x04', '\x1c', '\x1d', '\x1e', '\x1f')

    @classmethod
    def sanitize_for_xml(cls, value):
        """Sanitize a value for safe XML inclusion (returns escaped text)."""
        if value is None:
            return ''
        value = str(value)

        # Remove invalid XML characters and Tally internal delimiters
        value = cls.INVALID_XML_CHARS.sub('', value)
        for char in cls.TALLY_DELIMITER_CHARS:
            value = value.replace(char, '')

        # Normalize unicode + strip problem characters
        value = unicodedata.normalize('NFC', value)
        value = (value
                 .replace('\u00a0', ' ')    # non-breaking space
                 .replace('\u200b', '')     # zero-width space
                 .replace('\u200c', '')     # zero-width non-joiner
                 .replace('\u200d', '')     # zero-width joiner
                 .replace('\ufeff', ''))    # BOM

        # XML-escape the standard five entities
        value = (value
                 .replace('&', '&amp;')
                 .replace('<', '&lt;')
                 .replace('>', '&gt;')
                 .replace('"', '&quot;')
                 .replace("'", '&apos;'))

        return value.strip()

    @classmethod
    def sanitize_name(cls, name):
        """Sanitize a Tally name field (ledger, group, item ...)."""
        if not name:
            return ''
        name = cls.sanitize_for_xml(name)
        name = re.sub(r'\s+', ' ', name)                       # collapse spaces
        return name[:Config.MAX_FIELD_LENGTH]

    @classmethod
    def sanitize_amount(cls, amount):
        """Sanitize/validate an amount -> plain '1234.56' string."""
        if amount is None or amount == '':
            return '0'
        try:
            if isinstance(amount, str):
                amount = re.sub(r'[₹$€£¥,\s]', '', amount)
                if amount.startswith('(') and amount.endswith(')'):
                    amount = '-' + amount[1:-1]
            return str(Decimal(str(amount)).quantize(Decimal('0.00')))
        except (InvalidOperation, ValueError):
            logger.warning('Invalid amount value: %r', amount)
            return '0'

    @classmethod
    def sanitize_qty(cls, qty):
        """Quantities keep up to 3 decimals (no forced 2-dp rounding)."""
        if qty is None or qty == '':
            return '0'
        try:
            if isinstance(qty, str):
                qty = re.sub(r'[,\s]', '', qty)
            return str(Decimal(str(qty)).quantize(Decimal('0.001')))
        except (InvalidOperation, ValueError):
            return '0'

    @classmethod
    def sanitize_date(cls, date_value, default_today=True):
        """
        Convert many date formats -> Tally 'YYYYMMDD'.
        Returns None when unparseable and default_today is False.
        """
        if isinstance(date_value, (datetime, date)):
            return date_value.strftime('%Y%m%d')
        if not date_value:
            return datetime.now().strftime('%Y%m%d') if default_today else None

        date_str = str(date_value).strip()
        formats = (
            '%Y%m%d', '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y',
            '%Y/%m/%d', '%d-%b-%Y', '%d %b %Y', '%d.%m.%Y', '%B %d, %Y',
        )
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).strftime('%Y%m%d')
            except ValueError:
                continue
        logger.warning('Could not parse date: %r', date_value)
        return datetime.now().strftime('%Y%m%d') if default_today else None

    @classmethod
    def sanitize_narration(cls, narration):
        """Sanitize narration/description fields (single-line, bounded)."""
        if not narration:
            return ''
        narration = cls.sanitize_for_xml(narration)
        narration = narration.replace('\n', ' ').replace('\r', '')
        narration = re.sub(r'\s+', ' ', narration)
        return narration[:Config.MAX_NARRATION_LENGTH]

    # NOTE: text parsed via xml.etree.ElementTree is ALREADY unescaped by the
    # parser. Never double-unescape it (corrupts names like "A &amp; B Co").
    # unescape is only applied to raw ODBC strings.
    @classmethod
    def unescape_odbc_text(cls, value):
        """Unescape entity text coming from raw ODBC strings."""
        if not value:
            return ''
        value = str(value)
        for entity, char in (('&lt;', '<'), ('&gt;', '>'), ('&quot;', '"'),
                             ('&apos;', "'"), ('&amp;', '&')):
            value = value.replace(entity, char)
        value = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), value)
        value = re.sub(r'&#x([0-9a-fA-F]+);',
                       lambda m: chr(int(m.group(1), 16)), value)
        return value

    @classmethod
    def validate_xml_response(cls, xml_string):
        """Validate/clean an XML response from Tally. Returns clean XML or None."""
        if not xml_string:
            return None
        if isinstance(xml_string, bytes):
            xml_string = xml_string.decode('utf-8', errors='replace')
        if xml_string.startswith('\ufeff'):
            xml_string = xml_string[1:]
        xml_string = xml_string.replace('\x00', '')
        xml_string = cls.INVALID_XML_CHARS.sub('', xml_string)
        if not xml_string.strip().startswith('<?xml'):
            xml_string = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_string
        try:
            ET.fromstring(xml_string)
            return xml_string
        except ET.ParseError as exc:
            logger.error('XML Parse Error: %s', exc)
            fixed = cls._fix_common_xml_issues(xml_string)
            try:
                ET.fromstring(fixed)
                return fixed
            except ET.ParseError:
                return None

    @classmethod
    def _fix_common_xml_issues(cls, xml_string):
        """Fix the most common Tally XML malformation: bare ampersands."""
        return re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;|#)', '&amp;', xml_string)


def as_bool(value, default=False):
    """Coerce JSON/form values ('Yes','true',1,...) to a bool."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('yes', 'true', '1', 'y', 'on')


# ============================================================================
# ODBC CONNECTION MANAGER (optional fast read path)
# ============================================================================
class ODBCManager:
    """ODBC connections to Tally Prime with error handling + batching."""

    def __init__(self):
        self._is_initialized = False
        self._init_error = None

    @property
    def available(self):
        return PYODBC_AVAILABLE

    def _connection_string(self):
        if Config.ODBC_CONNECT_STRING:
            return Config.ODBC_CONNECT_STRING
        return f'DSN={Config.ODBC_DSN}'

    def initialize(self):
        """Probe the ODBC driver/DSN once at startup."""
        if not PYODBC_AVAILABLE:
            self._init_error = ('pyodbc is not installed - running in '
                                'XML-API-only mode (all features still work)')
            logger.warning(self._init_error)
            return False
        try:
            conn = pyodbc.connect(self._connection_string(), timeout=10)
            conn.close()
            self._is_initialized = True
            logger.info('ODBC connection pool initialized successfully')
            return True
        except Exception as exc:  # pyodbc.Error or DriverManager errors
            self._init_error = str(exc)
            logger.warning('ODBC initialization failed: %s', exc)
            return False

    def get_connection(self):
        if not PYODBC_AVAILABLE:
            raise RuntimeError('pyodbc is not installed on this machine. '
                               'Run: pip install pyodbc')
        conn = pyodbc.connect(self._connection_string(),
                              timeout=Config.REQUEST_TIMEOUT)
        try:
            conn.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')
            conn.setdecoding(pyodbc.SQL_WCHAR, encoding='utf-8')
            conn.setencoding(encoding='utf-8')
        except Exception:
            pass
        return conn

    def execute_query(self, query, params=None):
        """Execute an ODBC query; returns a list of row dicts."""
        conn = cursor = None
        results = []
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(query, params or [])
            if cursor.description:
                columns = [col[0] for col in cursor.description]
                while True:
                    rows = cursor.fetchmany(Config.MAX_RECORDS_PER_BATCH)
                    if not rows:
                        break
                    for row in rows:
                        row_dict = {}
                        for i, col in enumerate(columns):
                            value = row[i]
                            if isinstance(value, str):
                                value = XMLSanitizer.unescape_odbc_text(value)
                            elif isinstance(value, Decimal):
                                value = float(value)
                            row_dict[col] = value
                        results.append(row_dict)
            return results
        except Exception as exc:
            code = exc.args[0] if exc.args else 'Unknown'
            logger.error('ODBC Query Error [%s]: %s', code, exc)
            if 'HY001' in str(code):  # memory alloc error -> shrink batches
                Config.MAX_RECORDS_PER_BATCH = max(10,
                                                   Config.MAX_RECORDS_PER_BATCH // 2)
            raise
        finally:
            for closer in ((cursor and cursor.close), (conn and conn.close)):
                if closer:
                    try:
                        closer()
                    except Exception:
                        pass


# ============================================================================
# TALLY XML API CLIENT (read + write)
# ============================================================================
class TallyXMLClient:
    """
    All communication with Tally via the XML API (HTTP, default :9000).
    Reads use Export collections; writes use canonical Import envelopes
    (IMPORTDATA / REQUESTDESC / REQUESTDATA) that Tally Prime 2.x accepts.
    """

    def __init__(self):
        self._session = self._create_session()
        self._request_semaphore = threading.Semaphore(Config.MAX_CONCURRENT_REQUESTS)
        self._last_request_time = 0.0
        self._min_request_interval = 0.1  # 100 ms between requests to Tally

    # ---- transport --------------------------------------------------

    def _create_session(self):
        session = requests.Session()
        # Retries only for connection-level problems BEFORE a request is
        # sent. POST bodies (imports) are never replayed automatically -
        # that would duplicate vouchers inside Tally.
        retry_strategy = Retry(
            total=2,
            connect=2,
            read=0,
            backoff_factor=Config.RETRY_DELAY,
            status_forcelist=[502, 503, 504],
            allowed_methods=['GET', 'HEAD'],   # never replay POSTs
        )
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=Config.MAX_CONCURRENT_REQUESTS,
            pool_maxsize=Config.MAX_CONCURRENT_REQUESTS,
        )
        session.mount('http://', adapter)
        return session

    def _throttle_request(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < self._min_request_interval:
            time.sleep(self._min_request_interval - elapsed)
        self._last_request_time = time.time()

    def send_xml(self, xml_data, timeout=None, retry_connection=False):
        """
        Send an XML request to Tally, return parsed Element (or raw text).
        retry_connection=True re-attempts safely (Export reads only).
        """
        if not xml_data:
            return None
        timeout = timeout or Config.REQUEST_TIMEOUT

        xml_bytes = xml_data.encode('utf-8')
        if len(xml_bytes) > Config.MAX_XML_SIZE_BYTES:
            raise ValueError('XML request too large - would cause Tally '
                             f'memory issues ({len(xml_bytes)} bytes)')

        if not self._request_semaphore.acquire(timeout=timeout):
            raise TimeoutError('Too many concurrent requests to Tally')

        attempts = Config.MAX_RETRY_ATTEMPTS if retry_connection else 1
        try:
            for attempt in range(1, attempts + 1):
                try:
                    self._throttle_request()
                    response = self._session.post(
                        Config.TALLY_URL,
                        data=xml_bytes,
                        headers={'Content-Type': 'application/xml; charset=utf-8',
                                 'Content-Length': str(len(xml_bytes))},
                        timeout=timeout,
                    )
                    break
                except (requests.exceptions.ConnectionError,
                        requests.exceptions.Timeout) as exc:
                    if attempt >= attempts:
                        logger.error('Tally unreachable: %s', exc)
                        raise ConnectionError(
                            'Tally is not running or not accepting connections '
                            f'at {Config.TALLY_URL}. Start Tally Prime and make '
                            'sure the XML/API port is enabled.') from exc
                    time.sleep(Config.RETRY_DELAY)

        finally:
            self._request_semaphore.release()

        if response.status_code != 200:
            logger.error('Tally returned HTTP %s', response.status_code)
            return None

        clean = XMLSanitizer.validate_xml_response(response.text)
        if not clean:
            logger.warning('Could not parse Tally XML response')
            return response.text
        return ET.fromstring(clean)

    # ---- envelope builders -------------------------------------------

    @staticmethod
    def _export_envelope(collection_name, object_type, fetch_fields,
                         company=None, static_vars=None, tdl_extra=''):
        statics = ['<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>']
        if company:
            statics.append(
                f'<SVCURRENTCOMPANY>{XMLSanitizer.sanitize_for_xml(company)}'
                f'</SVCURRENTCOMPANY>')
        for key, value in (static_vars or {}).items():
            statics.append(f'<{key}>{XMLSanitizer.sanitize_for_xml(value)}</{key}>')
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>{collection_name}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        {''.join(statics)}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="{collection_name}">
            <TYPE>{object_type}</TYPE>
            <FETCH>{', '.join(fetch_fields)}</FETCH>
          </COLLECTION>
          {tdl_extra}
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>"""

    @staticmethod
    def _import_envelope(report_name, company, tallymessage_inner):
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>{XMLSanitizer.sanitize_for_xml(report_name)}</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>{XMLSanitizer.sanitize_for_xml(company)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
{tallymessage_inner}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""

    # ---- parsing helpers ----------------------------------------------

    @staticmethod
    def _get_text(element, tag, default=''):
        el = element.find(tag)
        if el is not None and el.text:
            return el.text.strip()
        return default

    def _fetch_collection(self, xml_request, item_tag):
        """Fetch a Collection export and flatten it into list[dict]."""
        root = self.send_xml(xml_request, retry_connection=True)
        return self._parse_collection(root, item_tag) if root is not None else []

    @staticmethod
    def _parse_collection(root, item_tag):
        items = []
        if not isinstance(root, ET.Element):
            return items
        for item in root.iter(item_tag):
            item_dict = {}
            for attr_name, attr_value in item.attrib.items():
                item_dict[f'_attr_{attr_name.upper()}'] = attr_value
            for child in item:
                tag = child.tag
                if len(child) > 0:  # nested list e.g. ALLLEDGERENTRIES.LIST
                    sub_list = item_dict.setdefault(tag, [])
                    if not isinstance(sub_list, list):
                        sub_list = item_dict[tag] = [sub_list]
                    sub_item = {}
                    for sub_child in child:
                        if sub_child.tag in sub_item:
                            existing = sub_item[sub_child.tag]
                            if not isinstance(existing, list):
                                sub_item[sub_child.tag] = [existing]
                            sub_item[sub_child.tag].append(
                                sub_child.text.strip() if sub_child.text else '')
                        else:
                            sub_item[sub_child.tag] = (
                                sub_child.text.strip() if sub_child.text else '')
                    sub_list.append(sub_item)
                else:
                    text = child.text.strip() if child.text else ''
                    if tag in item_dict and not isinstance(item_dict[tag], list):
                        item_dict[tag] = [item_dict[tag], text]
                    elif isinstance(item_dict.get(tag), list):
                        item_dict[tag].append(text)
                    else:
                        item_dict[tag] = text
            items.append(item_dict)
        return items

    # ---- company management -------------------------------------------

    def get_company_list(self):
        """Fetch the list of currently open companies in Tally."""
        xml_request = self._export_envelope(
            'CompanyList', 'Company',
            ['Name', 'FormalName', 'StartingFrom', 'BooksFrom',
             'PhoneNumber', 'Email'])
        root = self.send_xml(xml_request, retry_connection=True)
        companies = []
        if root is not None and isinstance(root, ET.Element):
            for company in root.iter('COMPANY'):
                name = (company.get('NAME')
                        or self._get_text(company, 'NAME')
                        or self._get_text(company, 'NAMELIST'))
                if not name:
                    continue
                companies.append({
                    'name': name,
                    'formal_name': self._get_text(company, 'FORMALNAME') or name,
                    'starting_from': self._get_text(company, 'STARTINGFROM'),
                    'books_from': self._get_text(company, 'BOOKSFROM'),
                    'phone': self._get_text(company, 'PHONENUMBER'),
                    'email': self._get_text(company, 'EMAIL'),
                })
        return companies

    def get_company_configuration(self, company_name):
        """Fetch configuration details of one company."""
        xml_request = self._export_envelope(
            'CompanyConfig', 'Company',
            ['Name', 'FormalName', 'StartingFrom', 'BooksFrom', 'Address',
             'PhoneNumber', 'Email', 'IncomeTaxNumber'],
            company=company_name)
        root = self.send_xml(xml_request, retry_connection=True)
        config = {}
        if root is not None and isinstance(root, ET.Element):
            company = next(root.iter('COMPANY'), None)
            if company is not None:
                for attr_name, attr_value in company.attrib.items():
                    config[attr_name.lower()] = attr_value
                for child in company:
                    if len(child) == 0:
                        config[child.tag.lower()] = (
                            child.text.strip() if child.text else '')
        return config

    def alter_company_feature(self, company_name, feature_name, value):
        """Alter one company configuration tag via Import."""
        safe_feature = XMLSanitizer.sanitize_name(feature_name)
        if not re.fullmatch(r'[A-Za-z0-9_.]+', safe_feature or ''):
            return {'success': False,
                    'errors': [f'Invalid feature name: {feature_name!r}']}
        safe_value = XMLSanitizer.sanitize_for_xml(value)
        inner = (f'          <COMPANY NAME="{XMLSanitizer.sanitize_for_xml(company_name)}" '
                 f'ACTION="Alter">\n'
                 f'            <{safe_feature}>{safe_value}</{safe_feature}>\n'
                 f'          </COMPANY>')
        xml_request = self._import_envelope('Company', company_name, inner)
        return self._parse_import_result(self.send_xml(xml_request))

    def get_company_alter_id(self, company_name):
        """Lightweight change-detection token for the sync engine."""
        xml_request = self._export_envelope(
            'SyncFingerprint', 'Company', ['AlterID'], company=company_name)
        try:
            root = self.send_xml(xml_request, timeout=8)
        except Exception:
            return None
        if root is not None and isinstance(root, ET.Element):
            for elem in root.iter('ALTERID'):
                return elem.text.strip() if elem.text else ''
        return None

    # ---- masters: read --------------------------------------------------

    def get_ledgers(self, company_name):
        xml_request = self._export_envelope(
            'LedgerList', 'Ledger',
            ['Name', 'Parent', 'OpeningBalance', 'ClosingBalance',
             'MailingName', 'Address', 'CountryName', 'StateName', 'PinCode',
             'LedgerPhone', 'Email', 'GSTNumber', 'IncomeTaxNumber',
             'CreditPeriod', 'CreditLimit', 'BankAccountNumber', 'IFSCCode'],
            company=company_name)
        raw = self._fetch_collection(xml_request, 'LEDGER')
        return [self._normalize_ledger(item) for item in raw]

    @staticmethod
    def _normalize_ledger(item):
        name = item.get('_attr_NAME') or item.get('NAME') or ''
        if isinstance(name, list):
            name = name[0] if name else ''
        address = item.get('ADDRESS.LIST')
        if isinstance(address, list):
            address = ', '.join(
                (e.get('ADDRESS', '') if isinstance(e, dict) else str(e))
                for e in address)
        return {
            'name': name,
            'parent': item.get('PARENT', ''),
            'opening_balance': item.get('OPENINGBALANCE', ''),
            'closing_balance': item.get('CLOSINGBALANCE', ''),
            'mailing_name': item.get('MAILINGNAME', ''),
            'address': address if isinstance(address, str) else '',
            'country': item.get('COUNTRYNAME', ''),
            'state': item.get('STATENAME', ''),
            'pincode': item.get('PINCODE', ''),
            'phone': item.get('LEDGERPHONE', ''),
            'email': item.get('EMAIL', ''),
            'gst_number': item.get('GSTNUMBER', ''),
            'pan_it': item.get('INCOMETAXNUMBER', ''),
            'credit_period': item.get('CREDITPERIOD', ''),
            'credit_limit': item.get('CREDITLIMIT', ''),
            'bank_account': item.get('BANKACCOUNTNUMBER', ''),
            'ifsc': item.get('IFSCCODE', ''),
        }

    def get_groups(self, company_name):
        xml_request = self._export_envelope(
            'GroupList', 'Group', ['Name', 'Parent', 'OpeningBalance',
                                   'ClosingBalance'],
            company=company_name)
        raw = self._fetch_collection(xml_request, 'GROUP')
        groups = []
        for item in raw:
            name = item.get('_attr_NAME') or item.get('NAME') or ''
            groups.append({
                'name': name,
                'parent': item.get('PARENT', ''),
                'opening_balance': item.get('OPENINGBALANCE', ''),
                'closing_balance': item.get('CLOSINGBALANCE', ''),
            })
        return groups

    def get_stock_items(self, company_name):
        xml_request = self._export_envelope(
            'StockItemList', 'StockItem',
            ['Name', 'Parent', 'BaseUnits', 'OpeningBalance',
             'ClosingBalance', 'Description'],
            company=company_name)
        raw = self._fetch_collection(xml_request, 'STOCKITEM')
        items = []
        for item in raw:
            name = item.get('_attr_NAME') or item.get('NAME') or ''
            items.append({
                'name': name,
                'parent': item.get('PARENT', ''),
                'units': item.get('BASEUNITS', ''),
                'opening_balance': item.get('OPENINGBALANCE', ''),
                'closing_balance': item.get('CLOSINGBALANCE', ''),
                'description': item.get('DESCRIPTION', ''),
            })
        return items

    def get_stock_groups(self, company_name):
        xml_request = self._export_envelope(
            'StockGroupList', 'StockGroup', ['Name', 'Parent'],
            company=company_name)
        raw = self._fetch_collection(xml_request, 'STOCKGROUP')
        return [{'name': i.get('_attr_NAME') or i.get('NAME', ''),
                 'parent': i.get('PARENT', '')} for i in raw]

    def get_units(self, company_name):
        xml_request = self._export_envelope(
            'UnitList', 'Unit', ['Name'], company=company_name)
        raw = self._fetch_collection(xml_request, 'UNIT')
        return [{'name': i.get('_attr_NAME') or i.get('NAME', '')} for i in raw]

    def get_currencies(self, company_name):
        xml_request = self._export_envelope(
            'CurrencyList', 'Currency', ['Name', 'Symbol'],
            company=company_name)
        raw = self._fetch_collection(xml_request, 'CURRENCY')
        return [{'name': i.get('_attr_NAME') or i.get('NAME', ''),
                 'symbol': i.get('SYMBOL', '')} for i in raw]

    def get_cost_centres(self, company_name):
        xml_request = self._export_envelope(
            'CostCentreList', 'CostCentre', ['Name', 'Parent'],
            company=company_name)
        raw = self._fetch_collection(xml_request, 'COSTCENTRE')
        return [{'name': i.get('_attr_NAME') or i.get('NAME', ''),
                 'parent': i.get('PARENT', '')} for i in raw]

    def get_cost_categories(self, company_name):
        xml_request = self._export_envelope(
            'CostCategoryList', 'CostCategory', ['Name'],
            company=company_name)
        raw = self._fetch_collection(xml_request, 'COSTCATEGORY')
        return [{'name': i.get('_attr_NAME') or i.get('NAME', '')} for i in raw]

    def get_godowns(self, company_name):
        xml_request = self._export_envelope(
            'GodownList', 'Godown', ['Name', 'Parent'],
            company=company_name)
        raw = self._fetch_collection(xml_request, 'GODOWN')
        return [{'name': i.get('_attr_NAME') or i.get('NAME', ''),
                 'parent': i.get('PARENT', '')} for i in raw]

    def get_voucher_types(self, company_name):
        xml_request = self._export_envelope(
            'VoucherTypeList', 'VoucherType', ['Name', 'Parent'],
            company=company_name)
        raw = self._fetch_collection(xml_request, 'VOUCHERTYPE')
        return [{'name': i.get('_attr_NAME') or i.get('NAME', ''),
                 'parent': i.get('PARENT', '')} for i in raw]

    # ---- masters: write -------------------------------------------------

    @staticmethod
    def _build_ledger_xml(ledger_data, action):
        name = XMLSanitizer.sanitize_name(ledger_data.get('name', ''))
        if not name:
            return None, ['Ledger name is required']
        parent = XMLSanitizer.sanitize_name(ledger_data.get('parent', '')
                                            or 'Sundry Debtors') or 'Sundry Debtors'

        lines = [
            f'          <LEDGER NAME="{name}" ACTION="{action}">',
            f'            <NAME.LIST><NAME>{name}</NAME></NAME.LIST>',
            f'            <PARENT>{parent}</PARENT>',
        ]
        # Optional fields are emitted only when supplied so Tally keeps its
        # existing values on Alter instead of overwriting them with zeros.
        optional_tags = [
            ('OPENINGBALANCE', ledger_data.get('opening_balance'),
             XMLSanitizer.sanitize_amount),
            ('CREDITLIMIT', ledger_data.get('credit_limit'),
             XMLSanitizer.sanitize_amount),
            ('CREDITPERIOD', ledger_data.get('credit_period'),
             XMLSanitizer.sanitize_for_xml),
            ('LEDGERPHONE', ledger_data.get('phone'),
             XMLSanitizer.sanitize_for_xml),
            ('EMAIL', ledger_data.get('email'), XMLSanitizer.sanitize_for_xml),
            ('PINCODE', ledger_data.get('pincode'),
             XMLSanitizer.sanitize_for_xml),
            ('COUNTRYNAME', ledger_data.get('country'),
             XMLSanitizer.sanitize_for_xml),
            ('LEDSTATENAME', ledger_data.get('state'),
             XMLSanitizer.sanitize_for_xml),
            ('GSTREGISTRATIONTYPE', ledger_data.get('gst_registration_type'),
             XMLSanitizer.sanitize_for_xml),
            ('PARTYGSTIN', ledger_data.get('gst_number'),
             XMLSanitizer.sanitize_for_xml),
            ('INCOMETAXNUMBER', ledger_data.get('pan_it'),
             XMLSanitizer.sanitize_for_xml),
            ('BANKACCOUNTNUMBER', ledger_data.get('bank_account'),
             XMLSanitizer.sanitize_for_xml),
            ('IFSCCODE', ledger_data.get('ifsc'),
             XMLSanitizer.sanitize_for_xml),
        ]
        for tag, value, sanitizer in optional_tags:
            if value not in (None, ''):
                lines.append(f'            <{tag}>{sanitizer(value)}</{tag}>')

        mailing = XMLSanitizer.sanitize_name(ledger_data.get('mailing_name', ''))
        if mailing:
            lines.append(f'            <MAILINGNAME.LIST>'
                         f'<MAILINGNAME>{mailing}</MAILINGNAME>'
                         f'</MAILINGNAME.LIST>')
        address = XMLSanitizer.sanitize_narration(ledger_data.get('address', ''))
        if address:
            lines.append(f'            <ADDRESS.LIST><ADDRESS>{address}'
                         f'</ADDRESS></ADDRESS.LIST>')
        if 'bill_by_bill' in ledger_data:
            lines.append(f'            <ISBILLWISE>'
                         f'{"Yes" if as_bool(ledger_data["bill_by_bill"]) else "No"}'
                         f'</ISBILLWISE>')
        lines.append('          </LEDGER>')
        return '\n'.join(lines), []

    def create_ledger(self, company_name, ledger_data):
        inner, errors = self._build_ledger_xml(ledger_data, 'Create')
        if errors:
            return {'success': False, 'errors': errors}
        xml_request = self._import_envelope('All Masters', company_name, inner)
        return self._parse_import_result(self.send_xml(xml_request))

    def alter_ledger(self, company_name, ledger_name, ledger_data):
        ledger_data = dict(ledger_data or {})
        ledger_data['name'] = ledger_name
        inner, errors = self._build_ledger_xml(ledger_data, 'Alter')
        if errors:
            return {'success': False, 'errors': errors}
        xml_request = self._import_envelope('All Masters', company_name, inner)
        return self._parse_import_result(self.send_xml(xml_request))

    def delete_ledger(self, company_name, ledger_name):
        name = XMLSanitizer.sanitize_name(ledger_name)
        if not name:
            return {'success': False, 'errors': ['Ledger name is required']}
        inner = (f'          <LEDGER NAME="{name}" ACTION="Delete">\n'
                 f'          </LEDGER>')
        xml_request = self._import_envelope('All Masters', company_name, inner)
        return self._parse_import_result(self.send_xml(xml_request))

    @staticmethod
    def _build_stock_item_xml(item_data, action):
        name = XMLSanitizer.sanitize_name(item_data.get('name', ''))
        if not name:
            return None, ['Stock item name is required']
        lines = [f'          <STOCKITEM NAME="{name}" ACTION="{action}">',
                 f'            <NAME.LIST><NAME>{name}</NAME></NAME.LIST>']
        parent = XMLSanitizer.sanitize_name(item_data.get('parent', ''))
        if parent:
            lines.append(f'            <PARENT>{parent}</PARENT>')
        units = XMLSanitizer.sanitize_name(item_data.get('units', ''))
        if units:
            lines.append(f'            <BASEUNITS>{units}</BASEUNITS>')
        description = XMLSanitizer.sanitize_narration(item_data.get('description', ''))
        if description:
            lines.append(f'            <DESCRIPTION>{description}</DESCRIPTION>')
        opening = item_data.get('opening_balance')
        if opening not in (None, ''):
            lines.append(f'            <OPENINGBALANCE>'
                         f'{XMLSanitizer.sanitize_amount(opening)}'
                         f'</OPENINGBALANCE>')
        lines.append('          </STOCKITEM>')
        return '\n'.join(lines), []

    def create_stock_item(self, company_name, item_data):
        inner, errors = self._build_stock_item_xml(item_data, 'Create')
        if errors:
            return {'success': False, 'errors': errors}
        xml_request = self._import_envelope('All Masters', company_name, inner)
        return self._parse_import_result(self.send_xml(xml_request))

    def alter_stock_item(self, company_name, item_name, item_data):
        item_data = dict(item_data or {})
        item_data['name'] = item_name
        inner, errors = self._build_stock_item_xml(item_data, 'Alter')
        if errors:
            return {'success': False, 'errors': errors}
        xml_request = self._import_envelope('All Masters', company_name, inner)
        return self._parse_import_result(self.send_xml(xml_request))

    def delete_stock_item(self, company_name, item_name):
        name = XMLSanitizer.sanitize_name(item_name)
        if not name:
            return {'success': False, 'errors': ['Stock item name is required']}
        inner = f'          <STOCKITEM NAME="{name}" ACTION="Delete"></STOCKITEM>'
        xml_request = self._import_envelope('All Masters', company_name, inner)
        return self._parse_import_result(self.send_xml(xml_request))

    # ---- vouchers ---------------------------------------------------------

    def get_vouchers(self, company_name, voucher_type=None, from_date=None,
                     to_date=None, page=1, page_size=50):
        """Fetch vouchers with filtering + pagination (normalized shape)."""
        default_from, default_to = financial_year()
        from_date = XMLSanitizer.sanitize_date(from_date,
                                               default_today=False) or default_from
        to_date = XMLSanitizer.sanitize_date(to_date,
                                             default_today=False) or default_to

        safe_type = XMLSanitizer.sanitize_for_xml(voucher_type) if voucher_type else ''
        xml_request = self._export_envelope(
            'VoucherCollection', 'Voucher',
            ['Date', 'VoucherTypeName', 'VoucherNumber', 'PartyLedgerName',
             'Amount', 'Narration', 'Reference', 'IsOptional', 'IsCancelled',
             'AllLedgerEntries.LedgerName', 'AllLedgerEntries.Amount',
             'AllLedgerEntries.IsDeemedPositive',
             'AllInventoryEntries.StockItemName', 'AllInventoryEntries.Rate',
             'AllInventoryEntries.Amount', 'AllInventoryEntries.ActualQty',
             'AllInventoryEntries.BilledQty'],
            company=company_name,
            static_vars={'SVFROMDATE': from_date, 'SVTODATE': to_date},
            tdl_extra=('' if not voucher_type else
                       f'<FILTER>VchTypeFilter</FILTER>\n'
                       f'<SYSTEM TYPE="Formulae" NAME="VchTypeFilter">'
                       f'$VoucherTypeName = "{safe_type}"</SYSTEM>'))
        raw = self._fetch_collection(xml_request, 'VOUCHER')
        vouchers = [self._normalize_voucher(v) for v in raw]
        vouchers.sort(key=lambda v: (v.get('date') or '', v.get('voucher_number')),
                      reverse=True)

        page = max(1, page)
        page_size = max(1, min(page_size, Config.MAX_RECORDS_PER_BATCH))
        start = (page - 1) * page_size
        return {
            'vouchers': vouchers[start:start + page_size],
            'total': len(vouchers),
            'page': page,
            'page_size': page_size,
            'total_pages': (len(vouchers) + page_size - 1) // page_size,
            'from_date': from_date,
            'to_date': to_date,
        }

    @staticmethod
    def _normalize_voucher(item):
        entries = []
        raw_entries = item.get('ALLLEDGERENTRIES.LIST', [])
        if isinstance(raw_entries, dict):
            raw_entries = [raw_entries]
        for entry in raw_entries:
            if not isinstance(entry, dict):
                continue
            amount = entry.get('AMOUNT', '0')
            is_debit = as_bool(entry.get('ISDEEMEDPOSITIVE'))
            try:
                amount_val = abs(Decimal(str(amount)))
            except (InvalidOperation, ValueError):
                amount_val = Decimal('0')
            entries.append({
                'ledger': entry.get('LEDGERNAME', ''),
                'amount': float(amount_val),
                'is_debit': is_debit,
                'bill_ref': entry.get('BILLREFLIST', ''),
            })
        inventory = []
        raw_inv = item.get('ALLINVENTORYENTRIES.LIST', [])
        if isinstance(raw_inv, dict):
            raw_inv = [raw_inv]
        for inv in raw_inv:
            if not isinstance(inv, dict):
                continue
            inventory.append({
                'stock_item': inv.get('STOCKITEMNAME', ''),
                'quantity': inv.get('ACTUALQTY', ''),
                'billed_qty': inv.get('BILLEDQTY', ''),
                'rate': inv.get('RATE', ''),
                'amount': inv.get('AMOUNT', ''),
            })
        return {
            'remote_id': item.get('_attr_REMOTEID', ''),
            'guid': item.get('GUID', ''),
            'date': item.get('DATE', ''),
            'voucher_type': item.get('VOUCHERTYPENAME', ''),
            'voucher_number': item.get('VOUCHERNUMBER', ''),
            'party_ledger': item.get('PARTYLEDGERNAME', ''),
            'amount': item.get('AMOUNT', ''),
            'narration': item.get('NARRATION', ''),
            'reference': item.get('REFERENCE', ''),
            'is_optional': as_bool(item.get('ISOPTIONAL')),
            'is_cancelled': as_bool(item.get('ISCANCELLED')),
            'ledger_entries': entries,
            'inventory_entries': inventory,
        }

    def _validate_voucher_data(self, data):
        errors = []
        if not data.get('voucher_type'):
            errors.append('Voucher type is required')
        if not data.get('date'):
            errors.append('Date is required')

        ledger_entries = data.get('ledger_entries') or []
        if len(ledger_entries) < 2:
            errors.append('At least 2 ledger entries are required '
                          '(debit and credit)')

        total_debit = Decimal('0')
        total_credit = Decimal('0')
        for entry in ledger_entries:
            if not entry.get('ledger_name'):
                errors.append('Ledger name is required in every entry')
                continue
            amount = Decimal(XMLSanitizer.sanitize_amount(entry.get('amount', 0)))
            if as_bool(entry.get('is_debit')) or str(
                    entry.get('drcr', '')).upper() == 'D':
                total_debit += abs(amount)
            else:
                total_credit += abs(amount)
        if ledger_entries and not errors:
            if abs(total_debit - total_credit) > Decimal('0.01'):
                errors.append(
                    f'Debit ({total_debit}) and Credit ({total_credit}) '
                    'must be equal')
        return errors

    @staticmethod
    def _build_voucher_xml(data, action, remote_id=None):
        voucher_type = XMLSanitizer.sanitize_name(data['voucher_type'])
        vch_date = XMLSanitizer.sanitize_date(data['date'])
        narration = XMLSanitizer.sanitize_narration(data.get('narration', ''))
        voucher_number = XMLSanitizer.sanitize_for_xml(
            data.get('voucher_number', ''))
        reference = XMLSanitizer.sanitize_for_xml(data.get('reference', ''))
        party_name = XMLSanitizer.sanitize_name(data.get('party_name', ''))

        remote_attr = f' REMOTEID="{XMLSanitizer.sanitize_for_xml(remote_id)}"' if remote_id else ''
        lines = [
            f'          <VOUCHER VCHTYPE="{voucher_type}" ACTION="{action}"{remote_attr}>',
            f'            <DATE>{vch_date}</DATE>',
            f'            <EFFECTIVEDATE>{vch_date}</EFFECTIVEDATE>',
            f'            <VOUCHERTYPENAME>{voucher_type}</VOUCHERTYPENAME>',
        ]
        if voucher_number:  # empty -> let Tally auto-number the voucher
            lines.append(f'            <VOUCHERNUMBER>{voucher_number}'
                         f'</VOUCHERNUMBER>')
        if reference:
            lines.append(f'            <REFERENCE>{reference}</REFERENCE>')
        if narration:
            lines.append(f'            <NARRATION>{narration}</NARRATION>')
        if party_name:
            lines.append(f'            <PARTYLEDGERNAME>{party_name}'
                         f'</PARTYLEDGERNAME>')

        for entry in data.get('ledger_entries', []):
            ledger_name = XMLSanitizer.sanitize_name(entry['ledger_name'])
            amount = XMLSanitizer.sanitize_amount(entry.get('amount', 0))
            is_debit = (as_bool(entry.get('is_debit'))
                        or str(entry.get('drcr', '')).upper() == 'D')
            # Tally convention: debit entries are negative amounts with
            # ISDEEMEDPOSITIVE = Yes
            if is_debit and not amount.startswith('-'):
                amount = '-' + amount
            if not is_debit and amount.startswith('-'):
                amount = amount[1:]
            lines += [
                '            <ALLLEDGERENTRIES.LIST>',
                f'              <LEDGERNAME>{ledger_name}</LEDGERNAME>',
                f'              <ISDEEMEDPOSITIVE>{"Yes" if is_debit else "No"}'
                '</ISDEEMEDPOSITIVE>',
                f'              <AMOUNT>{amount}</AMOUNT>',
                '            </ALLLEDGERENTRIES.LIST>',
            ]

        for entry in data.get('inventory_entries', []):
            stock_name = XMLSanitizer.sanitize_name(entry.get('stock_item', ''))
            qty = XMLSanitizer.sanitize_qty(entry.get('quantity', 0))
            rate = XMLSanitizer.sanitize_amount(entry.get('rate', 0))
            amount = XMLSanitizer.sanitize_amount(
                entry.get('amount') or
                (Decimal(qty) * Decimal(rate) if rate != '0' else '0'))
            unit = XMLSanitizer.sanitize_name(entry.get('unit', ''))
            qty_txt = f'{qty} {unit}' if unit else qty
            godown = XMLSanitizer.sanitize_name(entry.get('godown', ''))
            lines += [
                '            <ALLINVENTORYENTRIES.LIST>',
                f'              <STOCKITEMNAME>{stock_name}</STOCKITEMNAME>',
                f'              <ACTUALQTY>{qty_txt}</ACTUALQTY>',
                f'              <BILLEDQTY>{qty_txt}</BILLEDQTY>',
                f'              <RATE>{rate}</RATE>',
                f'              <AMOUNT>{amount}</AMOUNT>',
            ]
            if godown:
                lines.append(f'              <GODOWNNAME>{godown}</GODOWNNAME>')
            lines.append('            </ALLINVENTORYENTRIES.LIST>')

        lines.append('          </VOUCHER>')
        return '\n'.join(lines)

    def create_voucher(self, company_name, voucher_data):
        errors = self._validate_voucher_data(voucher_data)
        if errors:
            return {'success': False, 'errors': errors}
        inner = self._build_voucher_xml(voucher_data, 'Create')
        xml_request = self._import_envelope('Vouchers', company_name, inner)
        return self._parse_import_result(self.send_xml(xml_request))

    def alter_voucher(self, company_name, remote_id, voucher_data):
        if not remote_id:
            return {'success': False,
                    'errors': ['remote_id (REMOTEID/GUID) is required to '
                               'alter an existing voucher']}
        errors = self._validate_voucher_data(voucher_data)
        if errors:
            return {'success': False, 'errors': errors}
        inner = self._build_voucher_xml(voucher_data, 'Alter', remote_id)
        xml_request = self._import_envelope('Vouchers', company_name, inner)
        return self._parse_import_result(self.send_xml(xml_request))

    def delete_voucher(self, company_name, voucher_number=None, voucher_type=None,
                       voucher_date=None, remote_id=None):
        """Delete a voucher identified by REMOTEID (best) or no+type+date."""
        if not (remote_id or (voucher_number and voucher_type)):
            return {'success': False,
                    'errors': ['Provide remote_id, or voucher_number + '
                               'voucher_type (+ date)']}
        safe_type = XMLSanitizer.sanitize_name(voucher_type or '')
        safe_num = XMLSanitizer.sanitize_for_xml(voucher_number or '')
        safe_date = XMLSanitizer.sanitize_date(voucher_date) if voucher_date else ''
        remote_attr = (f' REMOTEID="{XMLSanitizer.sanitize_for_xml(remote_id)}"'
                       if remote_id else '')
        lines = [f'          <VOUCHER VCHTYPE="{safe_type}" ACTION="Delete"{remote_attr}>']
        if safe_date:
            lines.append(f'            <DATE>{safe_date}</DATE>')
        if safe_type:
            lines.append(f'            <VOUCHERTYPENAME>{safe_type}'
                         f'</VOUCHERTYPENAME>')
        if safe_num:
            lines.append(f'            <VOUCHERNUMBER>{safe_num}'
                         f'</VOUCHERNUMBER>')
        lines.append('          </VOUCHER>')
        xml_request = self._import_envelope('Vouchers', company_name,
                                            '\n'.join(lines))
        return self._parse_import_result(self.send_xml(xml_request))

    # ---- reports ----------------------------------------------------------

    def get_trial_balance(self, company_name, from_date=None, to_date=None):
        """Trial balance computed from ledger closing balances."""
        default_from, default_to = financial_year()
        to_date = XMLSanitizer.sanitize_date(to_date,
                                             default_today=False) or default_to
        ledgers = self.get_ledgers(company_name)   # cached upstream

        def to_float(text):
            try:
                return float(Decimal(str(text)))
            except (InvalidOperation, ValueError, TypeError):
                return 0.0

        rows, total_debit, total_credit = [], 0.0, 0.0
        for ledger in ledgers:
            balance = to_float(ledger.get('closing_balance')
                               or ledger.get('opening_balance'))
            if abs(balance) < 0.005:
                continue
            # Tally convention: negative closing balance = debit
            is_debit = balance < 0
            amount = abs(balance)
            rows.append({
                'ledger': ledger['name'],
                'parent': ledger.get('parent', ''),
                'debit': round(amount, 2) if is_debit else 0.0,
                'credit': 0.0 if is_debit else round(amount, 2),
            })
            total_debit += amount if is_debit else 0.0
            total_credit += 0.0 if is_debit else amount
        rows.sort(key=lambda r: r['ledger'].lower())
        return {
            'as_on': to_date,
            'rows': rows,
            'total_debit': round(total_debit, 2),
            'total_credit': round(total_credit, 2),
            'difference': round(total_debit - total_credit, 2),
        }

    def get_balance_sheet(self, company_name, as_on=None):
        """Balance Sheet via the built-in report object (raw structure)."""
        default_from, default_to = financial_year()
        to_date = XMLSanitizer.sanitize_date(as_on,
                                             default_today=False) or default_to
        xml_request = f"""<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Object</TYPE>
    <ID>Balance Sheet</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>{XMLSanitizer.sanitize_for_xml(company_name)}</SVCURRENTCOMPANY>
        <SVTODATE>{to_date}</SVTODATE>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>"""
        root = self.send_xml(xml_request, retry_connection=True)
        return _xml_to_dict(root) if isinstance(root, ET.Element) else {}

    def get_profit_loss(self, company_name, from_date=None, to_date=None):
        """Profit & Loss via the built-in report object (raw structure)."""
        default_from, default_to = financial_year()
        from_date = XMLSanitizer.sanitize_date(from_date,
                                               default_today=False) or default_from
        to_date = XMLSanitizer.sanitize_date(to_date,
                                             default_today=False) or default_to
        xml_request = f"""<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Object</TYPE>
    <ID>Profit and Loss A/c</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>{XMLSanitizer.sanitize_for_xml(company_name)}</SVCURRENTCOMPANY>
        <SVFROMDATE>{from_date}</SVFROMDATE>
        <SVTODATE>{to_date}</SVTODATE>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>"""
        root = self.send_xml(xml_request, retry_connection=True)
        return _xml_to_dict(root) if isinstance(root, ET.Element) else {}

    def get_day_book(self, company_name, target_date=None):
        """All vouchers of one day (defaults to today)."""
        target = XMLSanitizer.sanitize_date(target_date)
        return self.get_vouchers(company_name, from_date=target, to_date=target,
                                 page=1, page_size=Config.MAX_RECORDS_PER_BATCH)

    def get_ledger_vouchers(self, company_name, ledger_name,
                            from_date=None, to_date=None):
        """All vouchers touching one ledger."""
        default_from, default_to = financial_year()
        from_date = XMLSanitizer.sanitize_date(from_date,
                                               default_today=False) or default_from
        to_date = XMLSanitizer.sanitize_date(to_date,
                                             default_today=False) or default_to
        safe_ledger = XMLSanitizer.sanitize_for_xml(ledger_name)
        xml_request = self._export_envelope(
            'LedgerVouchers', 'Voucher',
            ['Date', 'VoucherTypeName', 'VoucherNumber', 'PartyLedgerName',
             'Amount', 'Narration', 'AllLedgerEntries.LedgerName',
             'AllLedgerEntries.Amount', 'AllLedgerEntries.IsDeemedPositive'],
            company=company_name,
            static_vars={'SVFROMDATE': from_date, 'SVTODATE': to_date},
            tdl_extra=('<FILTER>LedgerFilter</FILTER>\n'
                       '<SYSTEM TYPE="Formulae" NAME="LedgerFilter">'
                       '$$IsLedger:"' + safe_ledger + '"'
                       ':$AllLedgerEntries</SYSTEM>'))
        raw = self._fetch_collection(xml_request, 'VOUCHER')
        return [self._normalize_voucher(v) for v in raw]

    def get_dashboard(self, company_name):
        """Aggregated stats for the frontend home screen."""
        ledgers = self.get_ledgers(company_name)
        items = self.get_stock_items(company_name)
        vouchers = self.get_vouchers(company_name, page=1, page_size=5)
        tb = self.get_trial_balance(company_name)
        today = datetime.now().strftime('%Y%m%d')
        day_book = self.get_vouchers(company_name, from_date=today,
                                     to_date=today, page=1, page_size=100)

        def to_float(text):
            try:
                return float(Decimal(str(text)))
            except (InvalidOperation, ValueError, TypeError):
                return 0.0

        parties = sorted(
            ((l['name'], abs(to_float(l.get('closing_balance'))))
             for l in ledgers
             if l.get('parent') in ('Sundry Debtors', 'Sundry Creditors')
             and l['name']),
            key=lambda p: p[1], reverse=True)[:5]

        return {
            'company': company_name,
            'ledger_count': len(ledgers),
            'stock_item_count': len(items),
            'voucher_count_fy': vouchers.get('total', 0),
            'vouchers_today': day_book.get('total', 0),
            'trial_balance_total': tb.get('total_debit', 0.0),
            'difference': tb.get('difference', 0.0),
            'top_parties': [{'name': n, 'balance': b} for n, b in parties],
            'recent_vouchers': vouchers.get('vouchers', [])[:5],
            'generated_at': datetime.now().isoformat(),
        }

    # ---- import result parsing --------------------------------------------

    @staticmethod
    def _parse_import_result(result):
        """Parse Tally's Import response into a structured result dict."""
        if result is None:
            return {'success': False, 'errors': ['No response from Tally']}
        if not isinstance(result, ET.Element):
            return {'success': False,
                    'errors': ['Unexpected response format from Tally']}

        def count(tag):
            el = result.find(f'.//{tag}')
            try:
                return int(el.text.strip()) if el is not None and el.text else 0
            except ValueError:
                return 0

        created = count('CREATED')
        altered = count('ALTERED')
        deleted = count('DELETED')
        errors_count = count('ERRORS') + count('EXCEPTIONS') + count('REJECTED')

        line_errors = [el.text.strip() for el in result.iter('LINEERROR')
                       if el.text and el.text.strip()]
        # <ERRORS>0</ERRORS> with a LINEERROR still means that record failed
        if line_errors:
            return {'success': False, 'created': created, 'altered': altered,
                    'deleted': deleted, 'errors': line_errors}
        if errors_count > 0:
            return {'success': False, 'created': created, 'altered': altered,
                    'deleted': deleted,
                    'errors': [f'Tally reported {errors_count} error(s)']}
        if created or altered or deleted:
            return {'success': True, 'created': created, 'altered': altered,
                    'deleted': deleted,
                    'message': (f'Created: {created}, Altered: {altered}, '
                                f'Deleted: {deleted}')}
        # Tally sometimes answers 200 with zero counts and no error line
        # (e.g. duplicate suppressed). Treat as soft failure.
        return {'success': False,
                'errors': ['Tally accepted the request but reported no '
                           'created/altered/deleted records (possible '
                           'duplicate or unknown target)']}


def _xml_to_dict(element):
    """Convert an XML element tree to a JSON-safe dictionary."""
    result = {}
    for child in element:
        if len(child) > 0:
            child_dict = _xml_to_dict(child)
        else:
            child_dict = child.text.strip() if child.text else ''
        if child.tag in result:
            if not isinstance(result[child.tag], list):
                result[child.tag] = [result[child.tag]]
            result[child.tag].append(child_dict)
        else:
            result[child.tag] = child_dict
    return result


# ============================================================================
# SYNC ENGINE - Bidirectional Synchronization
# ============================================================================
class SyncEngine:
    """
    Polls each registered company's ALTER ID (a cheap single-field export).
    Any change in Tally (made by anyone - including the Tally UI itself)
    bumps the ALTER ID, and we push a WebSocket 'data_changed' event to all
    browsers plus invalidate the response cache.
    """

    def __init__(self, tally_client, odbc_manager):
        self.tally = tally_client
        self.odbc = odbc_manager
        self._running = False
        self._sync_thread = None
        self._data_cache = {}
        self._cache_timestamps = {}
        self._lock = threading.RLock()
        self._company_contexts = {}
        self._last_event = None
        self._tally_online = None

    # -- lifecycle -----------------------------------------------------
    def start(self):
        if self._running:
            return
        self._running = True
        self._sync_thread = threading.Thread(target=self._sync_loop,
                                             daemon=True, name='SyncEngine')
        self._sync_thread.start()
        logger.info('Sync engine started (interval=%ss)', Config.SYNC_INTERVAL)

    def stop(self):
        self._running = False
        if self._sync_thread:
            self._sync_thread.join(timeout=10)
        logger.info('Sync engine stopped')

    @property
    def running(self):
        return self._running

    def status(self):
        with self._lock:
            return {
                'running': self._running,
                'interval_seconds': Config.SYNC_INTERVAL,
                'tally_online': self._tally_online,
                'companies': {
                    name: {
                        'last_sync': ctx.get('last_sync'),
                        'alter_id': ctx.get('master_hash'),
                    } for name, ctx in self._company_contexts.items()
                },
                'cache_size': len(self._data_cache),
                'last_event': self._last_event,
            }

    # -- registration ----------------------------------------------------
    def register_company(self, company_name):
        with self._lock:
            if company_name not in self._company_contexts:
                self._company_contexts[company_name] = {
                    'last_sync': None,
                    'master_hash': None,
                }
                logger.info('Company registered for sync: %s', company_name)

    def unregister_company(self, company_name):
        with self._lock:
            self._company_contexts.pop(company_name, None)
        self._invalidate_cache(company_name)

    # -- polling loop ------------------------------------------------------
    def _sync_loop(self):
        while self._running:
            try:
                for company_name in list(self._company_contexts.keys()):
                    self._check_for_changes(company_name)
                time.sleep(Config.SYNC_INTERVAL)
            except Exception as exc:
                logger.error('Sync loop error: %s', exc)
                time.sleep(max(10, Config.SYNC_INTERVAL * 2))

    def _check_for_changes(self, company_name):
        try:
            current = self.tally.get_company_alter_id(company_name)
            with self._lock:
                was_online = self._tally_online
                self._tally_online = current is not None
                context = self._company_contexts.get(company_name, {})
                previous = context.get('master_hash')

            if current is None:
                if was_online:
                    self._broadcast(company_name, 'tally_offline')
                return

            if current != previous:
                first_seen = previous is None
                with self._lock:
                    self._company_contexts.setdefault(
                        company_name, {})['master_hash'] = current
                    self._company_contexts[company_name]['last_sync'] = \
                        datetime.now().isoformat()
                self._invalidate_cache(company_name)
                if not first_seen:  # don't spam on initial registration
                    logger.info('Changes detected in company: %s', company_name)
                    self._broadcast(company_name, 'data_changed')
                else:
                    self._broadcast(company_name, 'sync_started')
        except Exception as exc:
            logger.error('Change detection error for %s: %s', company_name, exc)

    def _broadcast(self, company, event_type, extra=None):
        payload = {'company': company, 'type': event_type,
                   'timestamp': datetime.now().isoformat()}
        payload.update(extra or {})
        with self._lock:
            self._last_event = payload
        socketio.emit('data_changed', payload)
        logger.info('Sync event: %s (%s)', event_type, company)

    # -- cache -----------------------------------------------------------
    def _invalidate_cache(self, company_name):
        with self._lock:
            prefix = company_name + ':'
            for key in [k for k in self._data_cache if k.startswith(prefix)]:
                del self._data_cache[key]
                self._cache_timestamps.pop(key, None)

    def get_cached_data(self, cache_key):
        with self._lock:
            if cache_key in self._data_cache:
                if time.time() - self._cache_timestamps.get(cache_key, 0) \
                        < Config.CACHE_TTL_SECONDS:
                    return self._data_cache[cache_key]
                self._data_cache.pop(cache_key, None)
                self._cache_timestamps.pop(cache_key, None)
        return None

    def set_cached_data(self, cache_key, data):
        with self._lock:
            cache_size = sum(sys.getsizeof(str(v)) for v in
                             self._data_cache.values())
            max_size = Config.MAX_CACHE_SIZE_MB * 1024 * 1024
            if cache_size > max_size:  # evict oldest entries first
                for key in sorted(self._cache_timestamps,
                                  key=lambda k: self._cache_timestamps[k]):
                    if cache_size <= max_size * 0.7:
                        break
                    cache_size -= sys.getsizeof(str(self._data_cache.get(key, '')))
                    self._data_cache.pop(key, None)
                    self._cache_timestamps.pop(key, None)
            self._data_cache[cache_key] = data
            self._cache_timestamps[cache_key] = time.time()


# ============================================================================
# INITIALIZE SERVICES
# ============================================================================
odbc_manager = ODBCManager()
tally_client = TallyXMLClient()
sync_engine = SyncEngine(tally_client, odbc_manager)


# ============================================================================
# API ERROR HANDLING
# ============================================================================
class APIError(Exception):
    def __init__(self, message, status_code=400, errors=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.errors = errors or []


@app.errorhandler(APIError)
def handle_api_error(error):
    return jsonify({'success': False, 'message': error.message,
                    'errors': error.errors}), error.status_code


@app.errorhandler(404)
def handle_404(_error):
    return jsonify({'success': False, 'message': 'Not found'}), 404


@app.errorhandler(500)
def handle_500(error):
    logger.error('Internal server error: %s', error)
    return jsonify({'success': False, 'message': 'Internal server error',
                    'errors': [str(error)]}), 500


@app.before_request
def log_request():
    request._start_time = time.time()


@app.after_request
def log_response(response):
    if request.path.startswith('/api/'):
        duration = (time.time() - getattr(request, '_start_time',
                                          time.time())) * 1000
        logger.info('%s %s -> %s (%.0f ms)', request.method, request.path,
                    response.status_code, duration)
    return response


def cached_or_fetch(cache_key, fetch_fn, company):
    """Return cached data or fetch + cache it."""
    cached = sync_engine.get_cached_data(cache_key)
    if cached is not None:
        return cached, True
    data = fetch_fn()
    sync_engine.set_cached_data(cache_key, data)
    return data, False


def announce_change(company, event_type, extra=None):
    sync_engine._invalidate_cache(company)
    payload = {'company': company, 'type': event_type,
               'timestamp': datetime.now().isoformat()}
    payload.update(extra or {})
    socketio.emit('data_changed', payload)


# ============================================================================
# API ROUTES - Static & Health
# ============================================================================
@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')


@app.route('/api/health', methods=['GET'])
def health_check():
    """System health check."""
    tally_status = 'disconnected'
    try:
        companies = tally_client.get_company_list()
        tally_status = 'connected' if companies is not None else 'error'
    except Exception:
        tally_status = 'disconnected'

    if not PYODBC_AVAILABLE:
        odbc_status = 'not_installed'
    else:
        try:
            odbc_manager.get_connection().close()
            odbc_status = 'connected'
        except Exception:
            odbc_status = 'disconnected'

    return jsonify({
        'status': 'running',
        'version': '1.0-phase1',
        'tally_xml_api': tally_status,
        'tally_url': Config.TALLY_URL,
        'tally_odbc': odbc_status,
        'odbc_detail': odbc_manager._init_error,
        'pyodbc_installed': PYODBC_AVAILABLE,
        'sync_engine': 'running' if sync_engine.running else 'stopped',
        'timestamp': datetime.now().isoformat(),
    })


@app.route('/api/connection/test', methods=['POST'])
def test_connection():
    """Test connectivity to Tally (optionally with custom host/port)."""
    data = request.get_json(silent=True) or {}
    tally_host = data.get('host', Config.TALLY_HOST)
    tally_port = int(data.get('port', Config.TALLY_PORT))
    test_url = f'http://{tally_host}:{tally_port}'

    results = {'xml_api': False, 'odbc': False, 'companies': [], 'url': test_url}

    probe = ('<?xml version="1.0" encoding="UTF-8"?>'
             '<ENVELOPE><HEADER><VERSION>1</VERSION>'
             '<TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE>'
             '<ID>CompanyList</ID></HEADER><BODY><DESC><STATICVARIABLES>'
             '<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>'
             '</STATICVARIABLES><TDL><TDLMESSAGE>'
             '<COLLECTION NAME="CompanyList"><TYPE>Company</TYPE>'
             '<FETCH>Name</FETCH></COLLECTION>'
             '</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>')
    try:
        response = requests.post(test_url, data=probe,
                                 headers={'Content-Type': 'application/xml'},
                                 timeout=10)
        results['xml_api'] = response.status_code == 200
    except Exception:
        pass

    if PYODBC_AVAILABLE:
        try:
            odbc_manager.get_connection().close()
            results['odbc'] = True
        except Exception:
            pass

    if results['xml_api']:
        old_url = Config.TALLY_URL
        try:
            Config.TALLY_URL = test_url
            results['companies'] = tally_client.get_company_list()
        except Exception:
            pass
        finally:
            Config.TALLY_URL = old_url

    return jsonify(results)


# ============================================================================
# API ROUTES - Company Management
# ============================================================================
@app.route('/api/companies', methods=['GET'])
def api_companies():
    try:
        return jsonify({'success': True,
                        'data': tally_client.get_company_list()})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/companies/<company_name>/config', methods=['GET'])
def api_company_config(company_name):
    try:
        config = tally_client.get_company_configuration(
            urllib.parse.unquote(company_name))
        return jsonify({'success': True, 'data': config})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/companies/<company_name>/config', methods=['PUT'])
def api_company_config_update(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data = request.get_json(silent=True) or {}
        results = []
        for feature, value in data.items():
            outcome = tally_client.alter_company_feature(company, feature, value)
            results.append({'feature': feature, 'result': outcome})
        any_success = any(r['result'].get('success') for r in results)
        announce_change(company, 'company_config_updated')
        return jsonify({'success': any_success, 'results': results})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/companies/<company_name>/select', methods=['POST'])
def api_select_company(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        sync_engine.register_company(company)
        return jsonify({'success': True,
                        'message': f'Company "{company}" selected - '
                                   'live sync active'})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/sync/status', methods=['GET'])
def api_sync_status():
    return jsonify({'success': True, 'data': sync_engine.status()})


# ============================================================================
# API ROUTES - Masters
# ============================================================================
@app.route('/api/<company_name>/ledgers', methods=['GET'])
def api_ledgers(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data, cached = cached_or_fetch(
            f'{company}:ledgers',
            lambda: tally_client.get_ledgers(company), company)
        return jsonify({'success': True, 'data': data, 'cached': cached})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/ledgers', methods=['POST'])
def api_create_ledger(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data = request.get_json(silent=True) or {}
        result = tally_client.create_ledger(company, data)
        if result.get('success'):
            announce_change(company, 'ledger_created',
                            {'ledger': data.get('name')})
        return jsonify(result)
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/ledgers/<ledger_name>', methods=['PUT'])
def api_alter_ledger(company_name, ledger_name):
    try:
        company = urllib.parse.unquote(company_name)
        ledger = urllib.parse.unquote(ledger_name)
        data = request.get_json(silent=True) or {}
        result = tally_client.alter_ledger(company, ledger, data)
        if result.get('success'):
            announce_change(company, 'ledger_altered', {'ledger': ledger})
        return jsonify(result)
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/ledgers/<ledger_name>', methods=['DELETE'])
def api_delete_ledger(company_name, ledger_name):
    try:
        company = urllib.parse.unquote(company_name)
        ledger = urllib.parse.unquote(ledger_name)
        result = tally_client.delete_ledger(company, ledger)
        if result.get('success'):
            announce_change(company, 'ledger_deleted', {'ledger': ledger})
        return jsonify(result)
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/groups', methods=['GET'])
def api_groups(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data, cached = cached_or_fetch(
            f'{company}:groups',
            lambda: tally_client.get_groups(company), company)
        return jsonify({'success': True, 'data': data, 'cached': cached})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/stock-items', methods=['GET'])
def api_stock_items(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data, cached = cached_or_fetch(
            f'{company}:stock_items',
            lambda: tally_client.get_stock_items(company), company)
        return jsonify({'success': True, 'data': data, 'cached': cached})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/stock-items', methods=['POST'])
def api_create_stock_item(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data = request.get_json(silent=True) or {}
        result = tally_client.create_stock_item(company, data)
        if result.get('success'):
            announce_change(company, 'stock_item_created',
                            {'item': data.get('name')})
        return jsonify(result)
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/stock-items/<item_name>', methods=['PUT'])
def api_alter_stock_item(company_name, item_name):
    try:
        company = urllib.parse.unquote(company_name)
        item = urllib.parse.unquote(item_name)
        data = request.get_json(silent=True) or {}
        result = tally_client.alter_stock_item(company, item, data)
        if result.get('success'):
            announce_change(company, 'stock_item_altered', {'item': item})
        return jsonify(result)
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/stock-items/<item_name>', methods=['DELETE'])
def api_delete_stock_item(company_name, item_name):
    try:
        company = urllib.parse.unquote(company_name)
        item = urllib.parse.unquote(item_name)
        result = tally_client.delete_stock_item(company, item)
        if result.get('success'):
            announce_change(company, 'stock_item_deleted', {'item': item})
        return jsonify(result)
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/stock-groups', methods=['GET'])
def api_stock_groups(company_name):
    try:
        return jsonify({'success': True, 'data': tally_client.get_stock_groups(
            urllib.parse.unquote(company_name))})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/units', methods=['GET'])
def api_units(company_name):
    try:
        return jsonify({'success': True, 'data': tally_client.get_units(
            urllib.parse.unquote(company_name))})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/currencies', methods=['GET'])
def api_currencies(company_name):
    try:
        return jsonify({'success': True, 'data': tally_client.get_currencies(
            urllib.parse.unquote(company_name))})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/cost-centres', methods=['GET'])
def api_cost_centres(company_name):
    try:
        return jsonify({'success': True, 'data': tally_client.get_cost_centres(
            urllib.parse.unquote(company_name))})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/cost-categories', methods=['GET'])
def api_cost_categories(company_name):
    try:
        return jsonify({'success': True, 'data': tally_client.get_cost_categories(
            urllib.parse.unquote(company_name))})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/godowns', methods=['GET'])
def api_godowns(company_name):
    try:
        return jsonify({'success': True, 'data': tally_client.get_godowns(
            urllib.parse.unquote(company_name))})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/voucher-types', methods=['GET'])
def api_voucher_types(company_name):
    try:
        return jsonify({'success': True, 'data': tally_client.get_voucher_types(
            urllib.parse.unquote(company_name))})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/odbc-query', methods=['POST'])
def api_odbc_query(company_name):
    """Run a read-only ODBC query (fast path, only when driver available)."""
    if not PYODBC_AVAILABLE:
        raise APIError('pyodbc is not installed on this machine '
                       '(pip install pyodbc)', 503)
    data = request.get_json(silent=True) or {}
    query = data.get('query', '')
    if not re.match(r'(?i)^\s*select', query or ''):
        raise APIError('Only SELECT queries are allowed')
    try:
        rows = odbc_manager.execute_query(query)
        return jsonify({'success': True, 'data': rows,
                        'row_count': len(rows)})
    except Exception as exc:
        raise APIError(str(exc), 500)


# ============================================================================
# API ROUTES - Vouchers
# ============================================================================
@app.route('/api/<company_name>/vouchers', methods=['GET'])
def api_vouchers(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        voucher_type = request.args.get('type')
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        try:
            page = int(request.args.get('page', 1))
            page_size = int(request.args.get('page_size', 50))
        except ValueError:
            raise APIError('page and page_size must be integers')

        default_from, default_to = financial_year()
        cache_key = (f"{company}:vouchers:{voucher_type or 'all'}:"
                     f"{from_date or default_from}:{to_date or default_to}")
        fetch = lambda: tally_client.get_vouchers(   # noqa: E731
            company, voucher_type, from_date, to_date, 1,
            Config.MAX_RECORDS_PER_BATCH * 100)   # cache the full result
        data, _cached = cached_or_fetch(cache_key, fetch, company)

        # paginate from the cached full list
        page = max(1, page)
        page_size = max(1, min(page_size, Config.MAX_RECORDS_PER_BATCH))
        vouchers = data['vouchers']
        start = (page - 1) * page_size
        return jsonify({'success': True, 'data': {
            'vouchers': vouchers[start:start + page_size],
            'total': data['total'], 'page': page, 'page_size': page_size,
            'total_pages': (data['total'] + page_size - 1) // page_size,
            'from_date': data.get('from_date'),
            'to_date': data.get('to_date'),
        }})
    except APIError:
        raise
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/vouchers', methods=['POST'])
def api_create_voucher(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data = request.get_json(silent=True) or {}
        result = tally_client.create_voucher(company, data)
        if result.get('success'):
            announce_change(company, 'voucher_created',
                            {'voucher_type': data.get('voucher_type')})
        return jsonify(result)
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/vouchers/<remote_id>', methods=['PUT'])
def api_alter_voucher(company_name, remote_id):
    try:
        company = urllib.parse.unquote(company_name)
        data = request.get_json(silent=True) or {}
        result = tally_client.alter_voucher(
            company, urllib.parse.unquote(remote_id), data)
        if result.get('success'):
            announce_change(company, 'voucher_altered')
        return jsonify(result)
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/vouchers/delete', methods=['POST'])
def api_delete_voucher(company_name):
    """
    Delete a voucher. Body: {remote_id} (preferred) or
    {voucher_number, voucher_type, date}.
    """
    try:
        company = urllib.parse.unquote(company_name)
        data = request.get_json(silent=True) or {}
        result = tally_client.delete_voucher(
            company,
            voucher_number=data.get('voucher_number'),
            voucher_type=data.get('voucher_type'),
            voucher_date=data.get('date'),
            remote_id=data.get('remote_id'))
        if result.get('success'):
            announce_change(company, 'voucher_deleted',
                            {'voucher_number': data.get('voucher_number')})
        return jsonify(result)
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/day-book', methods=['GET'])
def api_day_book(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data = tally_client.get_day_book(company, request.args.get('date'))
        return jsonify({'success': True, 'data': data})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/ledger-vouchers/<ledger_name>',
           methods=['GET'])
def api_ledger_vouchers(company_name, ledger_name):
    try:
        company = urllib.parse.unquote(company_name)
        ledger = urllib.parse.unquote(ledger_name)
        vouchers = tally_client.get_ledger_vouchers(
            company, ledger,
            request.args.get('from_date'), request.args.get('to_date'))
        return jsonify({'success': True, 'data': vouchers})
    except Exception as exc:
        raise APIError(str(exc), 500)


# ============================================================================
# API ROUTES - Reports & Dashboard
# ============================================================================
@app.route('/api/<company_name>/reports/trial-balance', methods=['GET'])
def api_trial_balance(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data, _ = cached_or_fetch(
            f"{company}:tb:{request.args.get('to_date', '')}",
            lambda: tally_client.get_trial_balance(
                company, request.args.get('from_date'),
                request.args.get('to_date')), company)
        return jsonify({'success': True, 'data': data})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/reports/balance-sheet', methods=['GET'])
def api_balance_sheet(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data = tally_client.get_balance_sheet(company,
                                              request.args.get('date'))
        return jsonify({'success': True, 'data': data})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/reports/profit-loss', methods=['GET'])
def api_profit_loss(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data = tally_client.get_profit_loss(
            company, request.args.get('from_date'),
            request.args.get('to_date'))
        return jsonify({'success': True, 'data': data})
    except Exception as exc:
        raise APIError(str(exc), 500)


@app.route('/api/<company_name>/dashboard', methods=['GET'])
def api_dashboard(company_name):
    try:
        company = urllib.parse.unquote(company_name)
        data = tally_client.get_dashboard(company)
        return jsonify({'success': True, 'data': data})
    except Exception as exc:
        raise APIError(str(exc), 500)


# ============================================================================
# WEBSOCKET EVENTS
# ============================================================================
@socketio.on('connect')
def handle_connect():
    logger.info('Client connected: %s', request.sid)
    emit('connected', {'status': 'connected', 'sid': request.sid})


@socketio.on('disconnect')
def handle_disconnect():
    logger.info('Client disconnected: %s', request.sid)


@socketio.on('subscribe_company')
def handle_subscribe(data):
    company_name = (data or {}).get('company')
    if company_name:
        sync_engine.register_company(company_name)
        emit('subscribed', {'company': company_name,
                            'sync_interval': Config.SYNC_INTERVAL})


@socketio.on('unsubscribe_company')
def handle_unsubscribe(data):
    company_name = (data or {}).get('company')
    if company_name:
        sync_engine.unregister_company(company_name)
        emit('unsubscribed', {'company': company_name})


@socketio.on('request_refresh')
def handle_refresh_request(data):
    company_name = (data or {}).get('company')
    if company_name:
        sync_engine._invalidate_cache(company_name)
        emit('refresh_triggered', {
            'company': company_name,
            'type': (data or {}).get('type', 'all'),
            'timestamp': datetime.now().isoformat()})


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================
BANNER = r"""
============================================================
   TALLY PRIME 2.1 - FRONTEND BRIDGE  |  Phase 1  v1.0
============================================================
   Tally XML API : {tally_url}
   ODBC          : {odbc}
   Frontend URL  : http://{host}:{port}
============================================================
"""


def main():
    print(BANNER.format(
        tally_url=Config.TALLY_URL,
        odbc=(Config.ODBC_CONNECT_STRING or f'DSN={Config.ODBC_DSN}') +
             ('  (pyodbc NOT installed - XML-only mode)'
              if not PYODBC_AVAILABLE else ''),
        host=Config.HOST,
        port=Config.PORT,
    ))

    logger.info('Initializing ODBC connection...')
    odbc_manager.initialize()

    sync_engine.start()

    logger.info('Bridge ready. Open http://%s:%s in your browser.',
                Config.HOST, Config.PORT)
    socketio.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        allow_unsafe_werkzeug=True,
        use_reloader=False,
    )


if __name__ == '__main__':
    main()
