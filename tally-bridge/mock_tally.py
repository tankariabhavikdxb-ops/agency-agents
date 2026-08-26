#!/usr/bin/env python3
"""
Mock Tally Prime 2.1 XML API server (development aid)
=====================================================
Emulates the parts of Tally's HTTP XML API (port 9000) that the bridge uses,
so the complete stack can be built/tested WITHOUT Tally running.

  * Export collections : companies, ledgers, groups, stock items, vouchers ...
  * Object exports     : Balance Sheet / Profit & Loss (illustrative data)
  * Imports            : create / alter / delete ledgers, stock items,
                         vouchers (kept in memory, ALTER ID bumped on change)

Run:  python mock_tally.py        (listens on 0.0.0.0:9000)

Then point the bridge at it:
      TALLY_HOST=127.0.0.1 python server.py
"""

import re
import sys
import time
import uuid
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s [MOCK-TALLY] %(message)s')
log = logging.getLogger('mock')

HOST = '0.0.0.0'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9000

# ============================================================================
# In-memory "Tally" data store
# ============================================================================
ALTER_ID = 4100
STATE = {'alter_id': ALTER_ID}

COMPANIES = [
    {'name': 'Demo Company (Mock)', 'formal': 'Demo Company Pvt Ltd',
     'from': '20250401', 'books': '20250401',
     'phone': '+91 98765 43210', 'email': 'info@democompany.example'},
    {'name': 'Mock Trading Co', 'formal': 'Mock Trading Company',
     'from': '20250401', 'books': '20250401',
     'phone': '+91 90000 00001', 'email': 'accounts@mocktrading.example'},
]

LEDGERS = [
    ('Cash', 'Cash-in-Hand', '-12500.00'),
    ('HDFC Bank', 'Bank Accounts', '-86400.00'),
    ('Sales Account', 'Sales Accounts', '243000.00'),
    ('Purchase Account', 'Purchase Accounts', '-98000.00'),
    ('Ramesh & Sons', 'Sundry Debtors', '-45600.00'),
    ('Global Traders <Pune>', 'Sundry Debtors', '-12300.00'),
    ('Sharma Suppliers', 'Sundry Creditors', '33200.00'),
    ('Office Expenses', 'Indirect Expenses', '-6100.00'),
    ('Rent', 'Indirect Expenses', '-24000.00'),
    ('Duties & Taxes', 'Duties & Taxes', '8700.00'),
]

GROUPS = [
    ('Cash-in-Hand', 'Assets'),
    ('Bank Accounts', 'Assets'),
    ('Sundry Debtors', 'Assets'),
    ('Sundry Creditors', 'Liabilities'),
    ('Sales Accounts', 'Income'),
    ('Purchase Accounts', 'Direct Expenses'),
    ('Indirect Expenses', 'Expenses'),
    ('Duties & Taxes', 'Liabilities'),
]

STOCK_ITEMS = [
    ('Widget A', 'Finished Goods', 'Nos', '-120.00'),
    ('Widget B', 'Finished Goods', 'Nos', '-80.00'),
    ('Raw Material X', 'Raw Materials', 'Kg', '-500.00'),
]
STOCK_GROUPS = [('Finished Goods', 'Primary'), ('Raw Materials', 'Primary')]
UNITS = [('Nos',), ('Kg',), ('Box',), ('Pcs',)]
CURRENCIES = [('INR', '₹')]
COST_CENTRES = [('Head Office', 'Primary'), ('Branch Mumbai', 'Primary')]
COST_CATEGORIES = [('Primary',)]
GODOWNS = [('Main Location', 'Primary')]
VOUCHER_TYPES = [('Receipt',), ('Payment',), ('Contra',), ('Journal',),
                 ('Sales',), ('Purchase',), ('Credit Note',), ('Debit Note',)]

VOUCHERS = []
_voucher_seed = [
    # (date, vchtype, no, party, debit_ledger, amount, credit_ledger, narr)
    ('20250601', 'Sales', '1', 'Ramesh & Sons', 'Ramesh & Sons',
     11800.00, 'Sales Account', 'Invoice #INV-001, cash sale batch A'),
    ('20250602', 'Payment', '1', 'Sharma Suppliers', 'Sharma Suppliers',
     5000.00, 'HDFC Bank', 'Part payment against bill #B-77'),
    ('20250604', 'Receipt', '1', 'Ramesh & Sons', 'HDFC Bank',
     11800.00, 'Ramesh & Sons', 'Full & final settlement INV-001'),
    ('20250610', 'Journal', '1', '', 'Rent',
     12000.00, 'Sharma Suppliers', 'June rent booked, payable to owner'),
    ('20250615', 'Sales', '2', 'Global Traders <Pune>', 'Global Traders <Pune>',
     24600.00, 'Sales Account', 'Invoice #INV-002 with special chars & <tags>'),
]
for vd in _voucher_seed:
    d, vt, no, party, dr_led, amt, cr_led, narr = vd
    VOUCHERS.append({
        'date': d, 'type': vt, 'no': no, 'party': party, 'narr': narr,
        'amount': amt, 'ref': '',
        'remote_id': str(uuid.uuid4()),
        'entries': [
            {'ledger': dr_led, 'amount': -abs(amt), 'is_debit': True},
            {'ledger': cr_led, 'amount': abs(amt), 'is_debit': False},
        ],
        'inventory': [],
    })


def bump_alter_id():
    STATE['alter_id'] += 1


# ============================================================================
# XML helpers
# ============================================================================
def esc(text):
    return (str(text)
            .replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;').replace("'", '&apos;'))


def collection_response(inner_items):
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DESC/>
    <DATA>
{inner_items}
    </DATA>
  </BODY>
</ENVELOPE>"""


def companies_xml():
    items = '\n'.join(
        f'      <TALLYMESSAGE><COMPANY NAME="{esc(c["name"])}">'
        f'<FORMALNAME>{esc(c["formal"])}</FORMALNAME>'
        f'<STARTINGFROM>{c["from"]}</STARTINGFROM>'
        f'<BOOKSFROM>{c["books"]}</BOOKSFROM>'
        f'<PHONENUMBER>{esc(c["phone"])}</PHONENUMBER>'
        f'<EMAIL>{esc(c["email"])}</EMAIL>'
        f'<ALTERID>{STATE["alter_id"]}</ALTERID>'
        f'</COMPANY></TALLYMESSAGE>'
        for c in COMPANIES)
    return collection_response(items)


def alter_id_xml():
    items = (f'      <TALLYMESSAGE><COMPANY NAME="{esc(COMPANIES[0]["name"])}">'
             f'<ALTERID>{STATE["alter_id"]}</ALTERID>'
             f'</COMPANY></TALLYMESSAGE>')
    return collection_response(items)


def ledgers_xml():
    items = '\n'.join(
        f'      <TALLYMESSAGE><LEDGER NAME="{esc(n)}" RESERVED="">'
        f'<NAME.LIST><NAME>{esc(n)}</NAME></NAME.LIST>'
        f'<PARENT>{esc(p)}</PARENT>'
        f'<OPENINGBALANCE>{ob}</OPENINGBALANCE>'
        f'<CLOSINGBALANCE>{ob}</CLOSINGBALANCE>'
        f'<MAILINGNAME.LIST><MAILINGNAME>{esc(n)}</MAILINGNAME></MAILINGNAME.LIST>'
        f'<ADDRESS.LIST><ADDRESS>Mock Address 123</ADDRESS></ADDRESS.LIST>'
        f'<LEDGERPHONE>+91 90000 00000</LEDGERPHONE>'
        f'<EMAIL>ledger@mock.example</EMAIL>'
        f'</LEDGER></TALLYMESSAGE>'
        for n, p, ob in LEDGERS)
    return collection_response(items)


def groups_xml():
    items = '\n'.join(
        f'      <TALLYMESSAGE><GROUP NAME="{esc(n)}">'
        f'<NAME.LIST><NAME>{esc(n)}</NAME></NAME.LIST>'
        f'<PARENT>{esc(p)}</PARENT></GROUP></TALLYMESSAGE>'
        for n, p in GROUPS)
    return collection_response(items)


def stock_items_xml():
    items = '\n'.join(
        f'      <TALLYMESSAGE><STOCKITEM NAME="{esc(n)}">'
        f'<NAME.LIST><NAME>{esc(n)}</NAME></NAME.LIST>'
        f'<PARENT>{esc(p)}</PARENT><BASEUNITS>{u}</BASEUNITS>'
        f'<OPENINGBALANCE>{ob} {u}</OPENINGBALANCE>'
        f'<CLOSINGBALANCE>{ob} {u}</CLOSINGBALANCE>'
        f'</STOCKITEM></TALLYMESSAGE>'
        for n, p, u, ob in STOCK_ITEMS)
    return collection_response(items)


def simple_list_xml(tag, rows):
    items = '\n'.join(
        f'      <TALLYMESSAGE><{tag} NAME="{esc(r[0])}">'
        f'<NAME.LIST><NAME>{esc(r[0])}</NAME></NAME.LIST>'
        + (f'<PARENT>{esc(r[1])}</PARENT>' if len(r) > 1 else '')
        + f'</{tag}></TALLYMESSAGE>'
        for r in rows)
    return collection_response(items)


def vouchers_xml():
    items = []
    for v in sorted(VOUCHERS, key=lambda x: x['date']):
        entries = ''.join(
            f'<ALLLEDGERENTRIES.LIST>'
            f'<LEDGERNAME>{esc(e["ledger"])}</LEDGERNAME>'
            f'<ISDEEMEDPOSITIVE>{"Yes" if e["is_debit"] else "No"}</ISDEEMEDPOSITIVE>'
            f'<AMOUNT>{e["amount"]:.2f}</AMOUNT>'
            f'</ALLLEDGERENTRIES.LIST>'
            for e in v['entries'])
        inventory = ''.join(
            f'<ALLINVENTORYENTRIES.LIST>'
            f'<STOCKITEMNAME>{esc(i["stock_item"])}</STOCKITEMNAME>'
            f'<ACTUALQTY>{i["quantity"]} {i.get("unit", "Nos")}</ACTUALQTY>'
            f'<BILLEDQTY>{i["quantity"]} {i.get("unit", "Nos")}</BILLEDQTY>'
            f'<RATE>{i["rate"]}</RATE><AMOUNT>{i["amount"]}</AMOUNT>'
            f'</ALLINVENTORYENTRIES.LIST>'
            for i in v['inventory'])
        items.append(
            f'      <TALLYMESSAGE><VOUCHER REMOTEID="{v["remote_id"]}" '
            f'VCHTYPE="{esc(v["type"])}" ACTION="Create">'
            f'<DATE>{v["date"]}</DATE>'
            f'<VOUCHERTYPENAME>{esc(v["type"])}</VOUCHERTYPENAME>'
            f'<VOUCHERNUMBER>{v["no"]}</VOUCHERNUMBER>'
            f'<REFERENCE>{esc(v.get("ref", ""))}</REFERENCE>'
            f'<PARTYLEDGERNAME>{esc(v["party"])}</PARTYLEDGERNAME>'
            f'<AMOUNT>{-abs(v["amount"]):.2f}</AMOUNT>'
            f'<NARRATION>{esc(v["narr"])}</NARRATION>'
            f'{entries}{inventory}'
            f'</VOUCHER></TALLYMESSAGE>')
    return collection_response('\n'.join(items))


BAL_SHEET_XML = """<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><BODY><IMPORTDATA><REQUESTDESC/><REQUESTDATA>
<TALLYMESSAGE><BSGROUP NAME="Assets">
  <BSMAINAMT>156800.00</BSMAINAMT>
  <BSSUBITEMS.LIST><BSLEDGERNAME>Cash</BSLEDGERNAME>
  <BSMAINAMT>12500.00</BSMAINAMT></BSSUBITEMS.LIST>
  <BSSUBITEMS.LIST><BSLEDGERNAME>HDFC Bank</BSLEDGERNAME>
  <BSMAINAMT>86400.00</BSMAINAMT></BSSUBITEMS.LIST>
</BSGROUP></TALLYMESSAGE>
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>"""

PL_XML = """<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><BODY><IMPORTDATA><REQUESTDESC/><REQUESTDATA>
<TALLYMESSAGE><PLGROUP NAME="Sales Accounts"><PLAMOUNT>243000.00</PLAMOUNT></PLGROUP></TALLYMESSAGE>
<TALLYMESSAGE><PLGROUP NAME="Purchase Accounts"><PLAMOUNT>-98000.00</PLAMOUNT></PLGROUP></TALLYMESSAGE>
<TALLYMESSAGE><PLGROUP NAME="Indirect Expenses"><PLAMOUNT>-30100.00</PLAMOUNT></PLGROUP></TALLYMESSAGE>
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>"""


# ============================================================================
# Import handling
# ============================================================================
def _text(node, tag, default=''):
    el = node.find(tag)
    return el.text.strip() if el is not None and el.text else default


def handle_import(root):
    """Process an Import envelope; returns (created, altered, deleted, errors)."""
    created = altered = deleted = 0
    errors = []

    for msg in root.iter('TALLYMESSAGE'):
        for node in msg:
            action = (node.get('ACTION') or 'Create').strip()
            tag = node.tag.upper()

            if tag == 'LEDGER':
                name = node.get('NAME') or _text(node, 'NAME') \
                    or _text(node, 'NAME.LIST/NAME')
                if not name:
                    errors.append('Ledger: missing name')
                    continue
                existing = any(n.lower() == name.lower() for n, _, _ in LEDGERS)
                if action == 'Delete':
                    if existing:
                        LEDGERS[:] = [l for l in LEDGERS
                                      if l[0].lower() != name.lower()]
                        deleted += 1
                        bump_alter_id()
                    else:
                        errors.append(f'Ledger "{name}": not found')
                elif action == 'Create' and existing:
                    errors.append(f'Ledger "{name}": already exists (Duplicated)')
                else:
                    parent = _text(node, 'PARENT', 'Sundry Debtors')
                    opening = _text(node, 'OPENINGBALANCE', '0.00')
                    if existing:
                        LEDGERS[:] = [(n, parent, opening) if n.lower() ==
                                      name.lower() else (n, p, o)
                                      for n, p, o in LEDGERS]
                        altered += 1
                    else:
                        LEDGERS.append((name, parent, opening))
                        created += 1
                    bump_alter_id()

            elif tag == 'STOCKITEM':
                name = node.get('NAME') or _text(node, 'NAME')
                if not name:
                    errors.append('StockItem: missing name')
                    continue
                existing = any(r[0].lower() == name.lower() for r in STOCK_ITEMS)
                if action == 'Delete':
                    if existing:
                        STOCK_ITEMS[:] = [s for s in STOCK_ITEMS
                                          if s[0].lower() != name.lower()]
                        deleted += 1
                        bump_alter_id()
                    else:
                        errors.append(f'StockItem "{name}": not found')
                elif action == 'Create' and existing:
                    errors.append(f'StockItem "{name}": already exists')
                else:
                    parent = _text(node, 'PARENT', 'Primary') or 'Primary'
                    units = _text(node, 'BASEUNITS', 'Nos') or 'Nos'
                    if existing:
                        STOCK_ITEMS[:] = [(name, parent, units, s[3]) if
                                          s[0].lower() == name.lower() else s
                                          for s in STOCK_ITEMS]
                        altered += 1
                    else:
                        STOCK_ITEMS.append((name, parent, units, '0.00'))
                        created += 1
                    bump_alter_id()

            elif tag == 'VOUCHER':
                vtype = node.get('VCHTYPE') or _text(node, 'VOUCHERTYPENAME',
                                                     'Journal')
                vdate = _text(node, 'DATE',
                              datetime.now().strftime('%Y%m%d'))
                remote_id = node.get('REMOTEID')
                vno = _text(node, 'VOUCHERNUMBER')
                narr = _text(node, 'NARRATION')
                entries = []
                for entry in node.findall('ALLLEDGERENTRIES.LIST'):
                    amt = float(_text(entry, 'AMOUNT', '0') or 0)
                    entries.append({
                        'ledger': _text(entry, 'LEDGERNAME'),
                        'amount': amt,
                        'is_debit': _text(entry, 'ISDEEMEDPOSITIVE') == 'Yes',
                    })
                inventory = []
                for inv in node.findall('ALLINVENTORYENTRIES.LIST'):
                    inventory.append({
                        'stock_item': _text(inv, 'STOCKITEMNAME'),
                        'quantity': _text(inv, 'ACTUALQTY', '0').split(' ')[0],
                        'rate': _text(inv, 'RATE', '0'),
                        'amount': _text(inv, 'AMOUNT', '0'),
                    })
                total = sum(abs(e['amount']) for e in entries
                            if e['is_debit']) or 0.0

                if action == 'Delete':
                    before = len(VOUCHERS)
                    target = [v for v in VOUCHERS
                              if (remote_id and v['remote_id'] == remote_id)
                              or (vno and v['no'] == vno
                                  and v['type'].lower() == vtype.lower()
                                  and v['date'] == vdate)]
                    if target:
                        VOUCHERS[:] = [v for v in VOUCHERS if v not in target]
                        deleted += len(target)
                        bump_alter_id()
                    else:
                        errors.append('Voucher: not found for delete')
                else:
                    if len(entries) < 2:
                        errors.append(
                            f'Voucher {vtype}: needs >= 2 ledger entries')
                        continue
                    if action == 'Alter' and remote_id:
                        for v in VOUCHERS:
                            if v['remote_id'] == remote_id:
                                v.update(date=vdate, type=vtype, no=vno,
                                         narr=narr, entries=entries,
                                         inventory=inventory,
                                         amount=total,
                                         party=_text(node, 'PARTYLEDGERNAME'))
                                altered += 1
                                break
                        else:
                            errors.append('Voucher: REMOTEID not found')
                    else:
                        if not vno:
                            same_type = [v for v in VOUCHERS
                                         if v['type'].lower() == vtype.lower()]
                            vno = str(len(same_type) + 1)
                        VOUCHERS.append({
                            'date': vdate, 'type': vtype, 'no': vno,
                            'party': _text(node, 'PARTYLEDGERNAME'),
                            'narr': narr, 'amount': total, 'ref':
                                _text(node, 'REFERENCE'),
                            'remote_id': remote_id or str(uuid.uuid4()),
                            'entries': entries, 'inventory': inventory,
                        })
                        created += 1
                    bump_alter_id()

            elif tag == 'COMPANY':
                # feature alteration on the company object
                altered += 1
                bump_alter_id()

    return created, altered, deleted, errors


# ============================================================================
# HTTP handler
# ============================================================================
class TallyHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        log.info('%s %s', self.command, fmt % args)

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)

        try:
            root = ET.fromstring(body)
        except ET.ParseError:
            self._reply(400, '<ENVELOPE><ERROR>Malformed XML</ERROR></ENVELOPE>')
            return

        request_type = (_text(root, 'HEADER/TALLYREQUEST')
                        or self._header_text(root, 'TALLYREQUEST'))
        request_id = self._header_text(root, 'ID')

        if request_type == 'Import' or root.find('.//IMPORTDATA') is not None:
            created, altered, deleted, errors = handle_import(root)
            err_xml = ''.join(
                f'<LINEERROR>{esc(e)}</LINEERROR>' for e in errors)
            response = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<ENVELOPE><BODY><IMPORTDATA>'
                '<REQUESTDESC/><REQUESTDATA/></IMPORTDATA></BODY>'
                f'<CREATED>{created}</CREATED><ALTERED>{altered}</ALTERED>'
                f'<DELETED>{deleted}</DELETED>'
                f'<ERRORS>{len(errors)}</ERRORS>'
                f'<REJECTED>{len(errors)}</REJECTED><EXCEPTIONS>0</EXCEPTIONS>'
                f'{err_xml}</ENVELOPE>')
            log.info('Import -> created=%d altered=%d deleted=%d errors=%d',
                     created, altered, deleted, len(errors))
            self._reply(200, response)
            return

        # ---- Export routing ------------------------------------------------
        collection = root.find('.//COLLECTION')
        collection_name = (collection.get('NAME', '') if collection is not None
                           else '') or request_id

        routing = {
            'CompanyList': companies_xml,
            'SyncFingerprint': alter_id_xml,
            'CompanyConfig': companies_xml,
            'LedgerList': ledgers_xml,
            'GroupList': groups_xml,
            'StockItemList': stock_items_xml,
            'StockGroupList': lambda: simple_list_xml('STOCKGROUP', STOCK_GROUPS),
            'UnitList': lambda: simple_list_xml('UNIT', UNITS),
            'CurrencyList': lambda: simple_list_xml('CURRENCY', CURRENCIES),
            'CostCentreList': lambda: simple_list_xml('COSTCENTRE',
                                                      COST_CENTRES),
            'CostCategoryList': lambda: simple_list_xml('COSTCATEGORY',
                                                        COST_CATEGORIES),
            'GodownList': lambda: simple_list_xml('GODOWN', GODOWNS),
            'VoucherTypeList': lambda: simple_list_xml('VOUCHERTYPE',
                                                       VOUCHER_TYPES),
            'VoucherCollection': vouchers_xml,
            'LedgerVouchers': vouchers_xml,
            'DayBookVouchers': vouchers_xml,
        }

        if collection_name in routing:
            self._reply(200, routing[collection_name]())
        elif 'Balance Sheet' in (request_id or ''):
            self._reply(200, BAL_SHEET_XML)
        elif 'Profit and Loss' in (request_id or ''):
            self._reply(200, PL_XML)
        else:
            log.warning('Unknown collection: %s (id=%s)', collection_name,
                        request_id)
            self._reply(200, collection_response(''))

    @staticmethod
    def _header_text(root, tag):
        for el in root.iter():
            if el.tag == tag and el.text:
                return el.text.strip()
        return ''

    def _reply(self, code, xml_text):
        payload = xml_text.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/xml; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main():
    server = ThreadingHTTPServer((HOST, PORT), TallyHandler)
    print(f"""
============================================================
   MOCK TALLY PRIME 2.1  -  development server
============================================================
   XML API : http://{HOST}:{PORT}
   Companies: {', '.join(c['name'] for c in COMPANIES)}
   Note    : data is IN-MEMORY; restart resets everything.
============================================================
""")
    log.info('Mock Tally listening on %s:%d', HOST, PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info('Mock Tally stopped')


if __name__ == '__main__':
    main()
