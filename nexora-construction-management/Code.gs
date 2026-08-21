/**
 * ============================================================================
 *  NEXORA LIMITED — CONSTRUCTION SITE MANAGEMENT SYSTEM
 *  Backend API — Google Apps Script (Code.gs)
 *  ---------------------------------------------------------------------------
 *  Deploy as Web App:  Deploy > New deployment > Web app
 *    - Execute as:  Me
 *    - Who has access:  Anyone
 *  Copy the Web App URL into index.html (API_URL constant).
 * ============================================================================
 */

// ============ CONFIGURATION ============
// Replace with your actual Google Spreadsheet ID (from the sheet URL)
var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// Entity registry: sheet name, ID prefix, ID column, headers, unique constraints
var ENTITIES = {
  Projects: {
    prefix: 'PRJ', id: 'ProjectID',
    headers: ['ProjectID','ProjectName','Location','ClientName','StartDate','ExpectedEndDate','Status','Description','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [['ProjectName']],
    required: ['ProjectName','Location','ClientName','StartDate']
  },
  Shops: {
    prefix: 'SHP', id: 'ShopID',
    headers: ['ShopID','ShopName','ProjectID','FloorLevel','Area_SqFt','Status','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [['ShopName']],
    required: ['ShopName','ProjectID']
  },
  ExpenseHeads: {
    prefix: 'EXP', id: 'ExpHeadID',
    headers: ['ExpHeadID','ExpHeadName','Category','Description','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [['ExpHeadName']],
    required: ['ExpHeadName','Category']
  },
  Materials: {
    prefix: 'ITM', id: 'MaterialID',
    headers: ['MaterialID','MaterialName','UnitID','Category','Description','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [['MaterialName']],
    required: ['MaterialName','UnitID']
  },
  Units: {
    prefix: 'UNT', id: 'UnitID',
    headers: ['UnitID','UnitName','Abbreviation','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [['UnitName']],
    required: ['UnitName','Abbreviation']
  },
  Suppliers: {
    prefix: 'SUP', id: 'SupplierID',
    headers: ['SupplierID','SupplierName','ContactPerson','Phone','Email','Address','TaxID','Status','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [['SupplierName']],
    required: ['SupplierName']
  },
  Customers: {
    prefix: 'CUS', id: 'CustomerID',
    headers: ['CustomerID','CustomerName','ContactPerson','Phone','Email','Address','TaxID','Status','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [['CustomerName']],
    required: ['CustomerName']
  },
  BudgetEntries: {
    prefix: 'BDG', id: 'BudgetID',
    headers: ['BudgetID','ProjectID','ShopID','ExpHeadID','MaterialID','Description','UnitID','Quantity','UnitRate','TotalAmount','Status','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [['ProjectID','ShopID','ExpHeadID','MaterialID']],
    required: ['ProjectID','ExpHeadID','MaterialID','Quantity','UnitRate']
  },
  Contracts: {
    prefix: 'CON', id: 'ContractID',
    headers: ['ContractID','ProjectID','ShopID','CustomerID','ContractType','ReferenceNo','ContractDate','ContractValue','Description','Status','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [['ReferenceNo']],
    required: ['ProjectID','CustomerID','ContractType','ReferenceNo','ContractDate','ContractValue']
  },
  ActualExpenses: {
    prefix: 'ACT', id: 'ExpenseID',
    headers: ['ExpenseID','ProjectID','BudgetID','ShopID','ExpHeadID','MaterialID','UnitID','SupplierID','ExpenseDate','Quantity','UnitRate','TotalAmount','InvoiceRef','Notes','Status','CreatedBy','CreatedDate','ModifiedBy','ModifiedDate'],
    unique: [],
    required: ['ProjectID','BudgetID','SupplierID','ExpenseDate','Quantity','UnitRate']
  }
};

var USERS_HEADERS = ['Username','FullName','Role'];
var AUDIT_HEADERS = ['LogID','Timestamp','UserName','Action','Module','RecordID','Details'];

var SYSTEM_USERS = [
  ['prashant','Prashant Khatri','Admin'],
  ['shakeel','Shakeel Patel','Admin'],
  ['bhavik','Bhavik Tankaria','Admin'],
  ['tanjani','Tanjani Malima','Admin'],
  ['davie','Davie Chavula','Admin']
];

// ============ ONE-TIME SETUP (run manually from the Apps Script editor) ============
function setupSheets() {
  var ss = getSpreadsheet_();
  Object.keys(ENTITIES).forEach(function (name) {
    ensureSheet_(ss, name, ENTITIES[name].headers);
  });
  // Users sheet (audit reference)
  var us = ensureSheet_(ss, 'Users', USERS_HEADERS);
  if (us.getLastRow() < 2) {
    us.getRange(2, 1, SYSTEM_USERS.length, 3).setValues(SYSTEM_USERS);
  }
  // Audit log
  ensureSheet_(ss, 'AuditLog', AUDIT_HEADERS);
  return 'Setup complete: 12 sheets ready.';
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var firstRow = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  if (String(firstRow[0] || '') !== headers[0]) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('SPREADSHEET_ID is not configured in Code.gs');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    if (ENTITIES[name]) sh = ensureSheet_(ss, name, ENTITIES[name].headers);
    else if (name === 'AuditLog') sh = ensureSheet_(ss, name, AUDIT_HEADERS);
    else if (name === 'Users') sh = ensureSheet_(ss, name, USERS_HEADERS);
    else throw new Error('Unknown sheet: ' + name);
  }
  return sh;
}

// ============ WEB APP ENTRY POINTS ============
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'ping';
    var p = e.parameter || {};
    var result;
    switch (action) {
      case 'ping':                    result = ok_({pong: true, version: getVersionHash_()}, 'API online'); break;
      case 'getAll':                  result = ok_(getAllData_(), 'All data fetched'); break;
      case 'getVersion':              result = ok_({version: getVersionHash_()}, 'Version fetched'); break;
      case 'getProjects':             result = listEntity_('Projects'); break;
      case 'getShops':                result = listEntity_('Shops'); break;
      case 'getExpenseHeads':         result = listEntity_('ExpenseHeads'); break;
      case 'getMaterials':            result = listEntity_('Materials'); break;
      case 'getUnits':                result = listEntity_('Units'); break;
      case 'getSuppliers':            result = listEntity_('Suppliers'); break;
      case 'getCustomers':            result = listEntity_('Customers'); break;
      case 'getBudgets':              result = listEntity_('BudgetEntries'); break;
      case 'getContracts':            result = listEntity_('Contracts'); break;
      case 'getExpenses':             result = listEntity_('ActualExpenses'); break;
      case 'getAuditLog':             result = listEntity_('AuditLog'); break;
      case 'getNextId':               result = ok_({nextId: generateNextId(p.entity ? p.entity : '', ENTITIES[p.entity] ? ENTITIES[p.entity].prefix : '')}, 'Next ID generated'); break;
      case 'checkDuplicate':          result = checkDuplicateApi_(p); break;
      case 'getDashboardData':        result = ok_(getDashboardData_(), 'Dashboard data fetched'); break;
      case 'getBudgetVsActual':       result = ok_(getBudgetVsActualReport_(p.projectId, p.shopId, p.expHeadId), 'Budget vs Actual generated'); break;
      case 'getProjectProfitability': result = ok_(getProjectProfitability_(p.projectId), 'Profitability generated'); break;
      case 'getItemWiseReport':       result = ok_(getItemWiseReport_(p.projectId, p.materialId), 'Item-wise report generated'); break;
      case 'getShopWiseReport':       result = ok_(getShopWiseReport_(p.projectId), 'Shop-wise report generated'); break;
      case 'getProjectWiseReport':    result = ok_(getProjectWiseReport_(), 'Project-wise report generated'); break;
      case 'getPnLReport':            result = ok_(getPnLReport_(p.projectId, p.dateFrom, p.dateTo), 'P&L generated'); break;
      case 'getSupplierWiseReport':   result = ok_(getSupplierWiseReport_(p.projectId, p.supplierId, p.dateFrom, p.dateTo), 'Supplier-wise report generated'); break;
      default:                        result = err_('Unknown action: ' + action);
    }
    return jsonOut_(result, e);
  } catch (ex) {
    return jsonOut_(err_('Server error', String(ex && ex.message ? ex.message : ex)), e);
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action || '';
    var user = body.user || 'system';
    var data = body.data || {};
    var result;

    // Named aliases (savior for spec-named routes) map to generic CRUD
    var aliasMap = {
      saveProject: ['create','Projects'],       updateProject: ['update','Projects'],       deleteProject: ['delete','Projects'],
      saveShop: ['create','Shops'],             updateShop: ['update','Shops'],             deleteShop: ['delete','Shops'],
      saveExpenseHead: ['create','ExpenseHeads'],updateExpenseHead: ['update','ExpenseHeads'],deleteExpenseHead: ['delete','ExpenseHeads'],
      saveMaterial: ['create','Materials'],     updateMaterial: ['update','Materials'],     deleteMaterial: ['delete','Materials'],
      saveUnit: ['create','Units'],             updateUnit: ['update','Units'],             deleteUnit: ['delete','Units'],
      saveSupplier: ['create','Suppliers'],     updateSupplier: ['update','Suppliers'],     deleteSupplier: ['delete','Suppliers'],
      saveCustomer: ['create','Customers'],     updateCustomer: ['update','Customers'],     deleteCustomer: ['delete','Customers'],
      saveBudget: ['create','BudgetEntries'],   updateBudget: ['update','BudgetEntries'],   deleteBudget: ['delete','BudgetEntries'],
      saveContract: ['create','Contracts'],     updateContract: ['update','Contracts'],     deleteContract: ['delete','Contracts'],
      saveExpense: ['create','ActualExpenses'], updateExpense: ['update','ActualExpenses'], deleteExpense: ['delete','ActualExpenses']
    };
    if (aliasMap[action]) {
      var mapped = aliasMap[action];
      action = mapped[0];
      body.entity = mapped[1];
    }

    var entity = body.entity || '';
    switch (action) {
      case 'create': result = createRecord_(entity, data, user); break;
      case 'update': result = updateRecord_(entity, data, user); break;
      case 'delete': result = deleteRecord_(entity, body.id || data.id, user); break;
      default:       result = err_('Unknown POST action: ' + action);
    }
    return jsonOut_(result, e);
  } catch (ex) {
    return jsonOut_(err_('Server error', String(ex && ex.message ? ex.message : ex)), e);
  }
}

// ============ RESPONSE HELPERS ============
function ok_(data, message, extra) {
  var out = {
    success: true,
    data: data,
    message: message || 'OK',
    timestamp: new Date().toISOString()
  };
  if (data && Object.prototype.toString.call(data) === '[object Array]') out.count = data.length;
  if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

function err_(error, details) {
  return {
    success: false,
    error: error,
    details: details || '',
    timestamp: new Date().toISOString()
  };
}

function jsonOut_(obj, e) {
  var json = JSON.stringify(obj);
  // JSONP support (fallback for environments where fetch/CORS is blocked)
  if (e && e.parameter && e.parameter.callback) {
    return ContentService
      .createTextOutput(e.parameter.callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ============ DATA ACCESS ============
function readAll_(sheetName) {
  var sh = getSheet_(sheetName);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[0]) === '') continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var v = row[j];
      if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
      obj[String(headers[j])] = v;
    }
    rows.push(obj);
  }
  return rows;
}

function listEntity_(name) {
  return ok_(readAll_(name), name + ' fetched successfully');
}

function getAllData_() {
  var out = {};
  Object.keys(ENTITIES).forEach(function (name) { out[name] = readAll_(name); });
  var audit = readAll_('AuditLog');
  // Only return the last 100 audit rows to keep the payload small
  out.AuditLog = audit.slice(Math.max(0, audit.length - 100));
  out.Users = readAll_('Users');
  out._version = getVersionHash_();
  return out;
}

function getVersionHash_() {
  var ss = getSpreadsheet_();
  var parts = [];
  Object.keys(ENTITIES).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    parts.push(name + ':' + (sh ? sh.getLastRow() : 0));
  });
  var audit = ss.getSheetByName('AuditLog');
  parts.push('AuditLog:' + (audit ? audit.getLastRow() : 0));
  return parts.join('|');
}

// ============ AUTO-SEQUENCE ID GENERATION ============
function generateNextId(sheetName, prefix) {
  if (!sheetName || !prefix) return '';
  var sh = getSheet_(sheetName);
  var lastRow = sh.getLastRow();
  var highest = 0;
  if (lastRow >= 2) {
    var ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i][0] || '');
      if (id.indexOf(prefix) === 0) {
        var num = parseInt(id.substring(prefix.length), 10);
        if (!isNaN(num) && num > highest) highest = num;
      }
    }
  }
  var next = highest + 1;
  var padded = String(next);
  while (padded.length < 3) padded = '0' + padded;
  return prefix + padded;
}

// ============ DUPLICATE CHECKING ============
function findDuplicate_(entity, data, excludeId) {
  var cfg = ENTITIES[entity];
  if (!cfg || !cfg.unique || cfg.unique.length === 0) return null;
  var rows = readAll_(entity);
  for (var u = 0; u < cfg.unique.length; u++) {
    var fields = cfg.unique[u];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (excludeId && String(row[cfg.id]) === String(excludeId)) continue;
      var match = true;
      for (var f = 0; f < fields.length; f++) {
        var a = String(row[fields[f]] === undefined || row[fields[f]] === null ? '' : row[fields[f]]).trim().toLowerCase();
        var b = String(data[fields[f]] === undefined || data[fields[f]] === null ? '' : data[fields[f]]).trim().toLowerCase();
        if (a !== b) { match = false; break; }
      }
      if (match) return { record: row, fields: fields };
    }
  }
  return null;
}

function duplicateMessage_(entity, dup) {
  var cfg = ENTITIES[entity];
  var labelField = dup.fields[dup.fields.length === 1 ? 0 : 0];
  if (dup.fields.length === 1) {
    return 'A record with ' + dup.fields[0] + " '" + dup.record[dup.fields[0]] + "' already exists (" + dup.record[cfg.id] + ')';
  }
  return 'This combination (' + dup.fields.join(' + ') + ') already exists (' + dup.record[cfg.id] + ')';
}

function checkDuplicateApi_(p) {
  var entity = p.entity;
  if (!ENTITIES[entity]) return err_('Unknown entity: ' + entity);
  var data = {};
  try { data = JSON.parse(p.data || '{}'); } catch (e) { return err_('Invalid data payload'); }
  var dup = findDuplicate_(entity, data, p.excludeId || '');
  if (dup) return ok_({duplicate: true, existingId: dup.record[ENTITIES[entity].id]}, duplicateMessage_(entity, dup));
  return ok_({duplicate: false}, 'No duplicate found');
}

// ============ VALIDATION ============
function validate_(entity, data) {
  var cfg = ENTITIES[entity];
  var missing = [];
  (cfg.required || []).forEach(function (f) {
    var v = data[f];
    if (v === undefined || v === null || String(v).trim() === '') missing.push(f);
  });
  if (missing.length) return 'Required field(s) missing: ' + missing.join(', ');
  // Numeric checks
  if (data.Quantity !== undefined && data.Quantity !== '' && Number(data.Quantity) <= 0) return 'Quantity must be greater than 0';
  if (data.UnitRate !== undefined && data.UnitRate !== '' && Number(data.UnitRate) <= 0) return 'Unit Rate must be greater than 0';
  if (data.ContractValue !== undefined && data.ContractValue !== '' && Number(data.ContractValue) <= 0) return 'Contract Value must be greater than 0';
  // Date order check for projects
  if (entity === 'Projects' && data.StartDate && data.ExpectedEndDate) {
    if (new Date(data.ExpectedEndDate) <= new Date(data.StartDate)) return 'Expected End Date must be after Start Date';
  }
  // Email format
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.Email && String(data.Email).trim() !== '' && !emailRe.test(String(data.Email).trim())) return 'Invalid email format: ' + data.Email;
  return null;
}

// ============ CRUD FUNCTIONS (GENERIC, USED BY ALL ENTITIES) ============
function createRecord_(entity, data, user) {
  var cfg = ENTITIES[entity];
  if (!cfg) return err_('Unknown entity: ' + entity);

  var vErr = validate_(entity, data);
  if (vErr) return err_('Validation failed', vErr);

  var dup = findDuplicate_(entity, data);
  if (dup) return err_('Duplicate entry found', duplicateMessage_(entity, dup));

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheet_(entity);
    var newId = generateNextId(entity, cfg.prefix);
    var now = nowStr_();
    data[cfg.id] = newId;
    data.CreatedBy = user;
    data.CreatedDate = now;
    data.ModifiedBy = user;
    data.ModifiedDate = now;
    // Server-side computed total
    if (data.Quantity !== undefined && data.UnitRate !== undefined) {
      data.TotalAmount = round2_(Number(data.Quantity) * Number(data.UnitRate));
    }
    var row = cfg.headers.map(function (h) { return data[h] !== undefined ? data[h] : ''; });
    sh.appendRow(row);
    logAudit(user, 'CREATE', entity, newId, JSON.stringify(data));
    return ok_(data, entity + ' record ' + newId + ' created successfully');
  } finally {
    lock.releaseLock();
  }
}

function updateRecord_(entity, data, user) {
  var cfg = ENTITIES[entity];
  if (!cfg) return err_('Unknown entity: ' + entity);
  var id = data[cfg.id];
  if (!id) return err_('Missing record ID for update');

  var vErr = validate_(entity, data);
  if (vErr) return err_('Validation failed', vErr);

  var dup = findDuplicate_(entity, data, id);
  if (dup) return err_('Duplicate entry found', duplicateMessage_(entity, dup));

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheet_(entity);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return err_('Record not found: ' + id);
    var ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    var rowIndex = -1;
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) { rowIndex = i + 2; break; }
    }
    if (rowIndex === -1) return err_('Record not found: ' + id);

    var existingVals = sh.getRange(rowIndex, 1, 1, cfg.headers.length).getValues()[0];
    var existing = {};
    cfg.headers.forEach(function (h, idx) {
      var v = existingVals[idx];
      if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
      existing[h] = v;
    });

    data.CreatedBy = existing.CreatedBy;
    data.CreatedDate = existing.CreatedDate;
    data.ModifiedBy = user;
    data.ModifiedDate = nowStr_();
    if (data.Quantity !== undefined && data.UnitRate !== undefined) {
      data.TotalAmount = round2_(Number(data.Quantity) * Number(data.UnitRate));
    }
    var row = cfg.headers.map(function (h) { return data[h] !== undefined ? data[h] : (existing[h] !== undefined ? existing[h] : ''); });
    sh.getRange(rowIndex, 1, 1, cfg.headers.length).setValues([row]);

    var changes = {};
    cfg.headers.forEach(function (h) {
      if (String(existing[h]) !== String(data[h] !== undefined ? data[h] : existing[h])) {
        changes[h] = { from: existing[h], to: data[h] };
      }
    });
    logAudit(user, 'UPDATE', entity, id, JSON.stringify(changes));
    return ok_(data, entity + ' record ' + id + ' updated successfully');
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord_(entity, id, user) {
  var cfg = ENTITIES[entity];
  if (!cfg) return err_('Unknown entity: ' + entity);
  if (!id) return err_('Missing record ID for delete');

  // Referential integrity guards
  var refErr = checkReferences_(entity, id);
  if (refErr) return err_('Cannot delete record', refErr);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getSheet_(entity);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return err_('Record not found: ' + id);
    var ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        sh.deleteRow(i + 2);
        logAudit(user, 'DELETE', entity, id, JSON.stringify({deleted: id}));
        return ok_({deleted: id}, entity + ' record ' + id + ' deleted successfully');
      }
    }
    return err_('Record not found: ' + id);
  } finally {
    lock.releaseLock();
  }
}

function checkReferences_(entity, id) {
  var refs = {
    Projects: [['Shops','ProjectID'],['BudgetEntries','ProjectID'],['Contracts','ProjectID'],['ActualExpenses','ProjectID']],
    Shops: [['BudgetEntries','ShopID'],['Contracts','ShopID'],['ActualExpenses','ShopID']],
    ExpenseHeads: [['BudgetEntries','ExpHeadID'],['ActualExpenses','ExpHeadID']],
    Materials: [['BudgetEntries','MaterialID'],['ActualExpenses','MaterialID']],
    Units: [['Materials','UnitID'],['BudgetEntries','UnitID'],['ActualExpenses','UnitID']],
    Suppliers: [['ActualExpenses','SupplierID']],
    Customers: [['Projects','ClientName'],['Contracts','CustomerID']],
    BudgetEntries: [['ActualExpenses','BudgetID']]
  };
  var checks = refs[entity];
  if (!checks) return null;
  for (var i = 0; i < checks.length; i++) {
    var rows = readAll_(checks[i][0]);
    for (var j = 0; j < rows.length; j++) {
      if (String(rows[j][checks[i][1]]) === String(id)) {
        return 'This record is referenced by ' + checks[i][0] + ' (' + rows[j][ENTITIES[checks[i][0]].id] + '). Remove dependent records first.';
      }
    }
  }
  return null;
}

// ============ AUDIT LOGGING ============
function logAudit(userName, action, module, recordId, details) {
  try {
    var sh = getSheet_('AuditLog');
    var lastRow = sh.getLastRow();
    var nextLogId = 1;
    if (lastRow >= 2) {
      var lastId = sh.getRange(lastRow, 1).getValue();
      nextLogId = (parseInt(lastId, 10) || 0) + 1;
    }
    var det = String(details || '');
    if (det.length > 4000) det = det.substring(0, 4000) + '…';
    sh.appendRow([nextLogId, nowStr_(), userName, action, module, recordId, det]);
  } catch (e) {
    // Audit failures should never block the main operation
  }
}

// ============ REPORTING FUNCTIONS ============
function getDashboardData_() {
  var projects = readAll_('Projects');
  var budgets = readAll_('BudgetEntries');
  var contracts = readAll_('Contracts');
  var expenses = readAll_('ActualExpenses');
  var heads = readAll_('ExpenseHeads');
  var audit = readAll_('AuditLog');

  var totalBudget = sum_(budgets, 'TotalAmount');
  var totalContracts = sum_(contracts.filter(function (c) { return c.Status !== 'Cancelled'; }), 'ContractValue');
  var totalExpenses = sum_(expenses, 'TotalAmount');
  var activeProjects = projects.filter(function (p) { return p.Status === 'Active'; }).length;

  // Budget vs actual per project
  var perProject = projects.map(function (p) {
    var b = sum_(budgets.filter(function (x) { return x.ProjectID === p.ProjectID; }), 'TotalAmount');
    var e = sum_(expenses.filter(function (x) { return x.ProjectID === p.ProjectID; }), 'TotalAmount');
    var c = sum_(contracts.filter(function (x) { return x.ProjectID === p.ProjectID && x.Status !== 'Cancelled'; }), 'ContractValue');
    return { projectId: p.ProjectID, projectName: p.ProjectName, budget: b, expenses: e, contracts: c,
             utilization: b > 0 ? round2_(e / b * 100) : 0, profitLoss: round2_(c - e) };
  });

  // Expense distribution by head
  var byHead = {};
  expenses.forEach(function (x) {
    var head = heads.filter(function (h) { return h.ExpHeadID === x.ExpHeadID; })[0];
    var name = head ? head.ExpHeadName : (x.ExpHeadID || 'Unknown');
    byHead[name] = (byHead[name] || 0) + Number(x.TotalAmount || 0);
  });

  // Monthly trend (last 12 months)
  var trend = {};
  expenses.forEach(function (x) {
    var d = new Date(x.ExpenseDate);
    if (isNaN(d.getTime())) return;
    var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    trend[key] = (trend[key] || 0) + Number(x.TotalAmount || 0);
  });

  return {
    kpis: {
      totalProjects: projects.length,
      activeProjects: activeProjects,
      totalBudget: totalBudget,
      totalContracts: totalContracts,
      totalExpenses: totalExpenses,
      budgetUtilization: totalBudget > 0 ? round2_(totalExpenses / totalBudget * 100) : 0,
      profitLoss: round2_(totalContracts - totalExpenses)
    },
    perProject: perProject,
    expensesByHead: byHead,
    monthlyTrend: trend,
    recentActivity: audit.slice(Math.max(0, audit.length - 10)).reverse()
  };
}

function getBudgetVsActualReport_(projectId, shopId, expHeadId) {
  var budgets = readAll_('BudgetEntries').filter(function (b) {
    if (projectId && b.ProjectID !== projectId) return false;
    if (shopId && b.ShopID !== shopId) return false;
    if (expHeadId && b.ExpHeadID !== expHeadId) return false;
    return true;
  });
  var expenses = readAll_('ActualExpenses');
  return budgets.map(function (b) {
    var actual = expenses.filter(function (e) { return e.BudgetID === b.BudgetID; });
    var actualAmt = sum_(actual, 'TotalAmount');
    var actualQty = sum_(actual, 'Quantity');
    return {
      budgetId: b.BudgetID, projectId: b.ProjectID, shopId: b.ShopID, expHeadId: b.ExpHeadID,
      materialId: b.MaterialID, unitId: b.UnitID,
      budgetQty: Number(b.Quantity || 0), budgetAmount: Number(b.TotalAmount || 0),
      actualQty: actualQty, actualAmount: actualAmt,
      variance: round2_(Number(b.TotalAmount || 0) - actualAmt),
      utilization: Number(b.TotalAmount) > 0 ? round2_(actualAmt / Number(b.TotalAmount) * 100) : 0
    };
  });
}

function getProjectProfitability_(projectId) {
  var contracts = readAll_('Contracts').filter(function (c) { return (!projectId || c.ProjectID === projectId) && c.Status !== 'Cancelled'; });
  var expenses = readAll_('ActualExpenses').filter(function (e) { return !projectId || e.ProjectID === projectId; });
  var budgets = readAll_('BudgetEntries').filter(function (b) { return !projectId || b.ProjectID === projectId; });
  var heads = readAll_('ExpenseHeads');

  var contractRev = sum_(contracts.filter(function (c) { return c.ContractType !== 'Sales Invoice'; }), 'ContractValue');
  var invoiceRev = sum_(contracts.filter(function (c) { return c.ContractType === 'Sales Invoice'; }), 'ContractValue');
  var totalIncome = contractRev + invoiceRev;

  var byCategory = {};
  expenses.forEach(function (e) {
    var head = heads.filter(function (h) { return h.ExpHeadID === e.ExpHeadID; })[0];
    var cat = head ? (head.Category || 'Other') : 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.TotalAmount || 0);
  });
  var totalExpenses = sum_(expenses, 'TotalAmount');
  var totalBudget = sum_(budgets, 'TotalAmount');

  return {
    income: { contractRevenue: contractRev, invoiceRevenue: invoiceRev, total: totalIncome },
    expensesByCategory: byCategory,
    totalExpenses: totalExpenses,
    grossProfit: round2_(totalIncome - totalExpenses),
    profitMargin: totalIncome > 0 ? round2_((totalIncome - totalExpenses) / totalIncome * 100) : 0,
    totalBudget: totalBudget,
    budgetUtilization: totalBudget > 0 ? round2_(totalExpenses / totalBudget * 100) : 0,
    budgetRemaining: round2_(totalBudget - totalExpenses)
  };
}

function getItemWiseReport_(projectId, materialId) {
  var budgets = readAll_('BudgetEntries').filter(function (b) {
    return (!projectId || b.ProjectID === projectId) && (!materialId || b.MaterialID === materialId);
  });
  var expenses = readAll_('ActualExpenses').filter(function (e) {
    return (!projectId || e.ProjectID === projectId) && (!materialId || e.MaterialID === materialId);
  });
  var materials = {};
  budgets.forEach(function (b) {
    var m = materials[b.MaterialID] = materials[b.MaterialID] || { materialId: b.MaterialID, unitId: b.UnitID, budgetQty: 0, budgetAmount: 0, actualQty: 0, actualAmount: 0 };
    m.budgetQty += Number(b.Quantity || 0);
    m.budgetAmount += Number(b.TotalAmount || 0);
  });
  expenses.forEach(function (e) {
    var m = materials[e.MaterialID] = materials[e.MaterialID] || { materialId: e.MaterialID, unitId: e.UnitID, budgetQty: 0, budgetAmount: 0, actualQty: 0, actualAmount: 0 };
    m.actualQty += Number(e.Quantity || 0);
    m.actualAmount += Number(e.TotalAmount || 0);
  });
  return Object.keys(materials).map(function (k) {
    var m = materials[k];
    m.varianceAmount = round2_(m.budgetAmount - m.actualAmount);
    m.varianceQty = round2_(m.budgetQty - m.actualQty);
    return m;
  });
}

function getShopWiseReport_(projectId) {
  var shops = readAll_('Shops').filter(function (s) { return !projectId || s.ProjectID === projectId; });
  var budgets = readAll_('BudgetEntries');
  var expenses = readAll_('ActualExpenses');
  var contracts = readAll_('Contracts');
  return shops.map(function (s) {
    var b = sum_(budgets.filter(function (x) { return x.ShopID === s.ShopID; }), 'TotalAmount');
    var e = sum_(expenses.filter(function (x) { return x.ShopID === s.ShopID; }), 'TotalAmount');
    var c = sum_(contracts.filter(function (x) { return x.ShopID === s.ShopID && x.Status !== 'Cancelled'; }), 'ContractValue');
    return { shopId: s.ShopID, shopName: s.ShopName, projectId: s.ProjectID, budget: b, expenses: e, contracts: c,
             utilization: b > 0 ? round2_(e / b * 100) : 0, profitLoss: round2_(c - e) };
  });
}

function getProjectWiseReport_() {
  return getDashboardData_().perProject;
}

function getPnLReport_(projectId, dateFrom, dateTo) {
  var from = dateFrom ? new Date(dateFrom) : null;
  var to = dateTo ? new Date(dateTo) : null;
  function inRange(dStr) {
    var d = new Date(dStr);
    if (isNaN(d.getTime())) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }
  var contracts = readAll_('Contracts').filter(function (c) {
    return (!projectId || c.ProjectID === projectId) && c.Status !== 'Cancelled' && (!from && !to ? true : inRange(c.ContractDate));
  });
  var expenses = readAll_('ActualExpenses').filter(function (e) {
    return (!projectId || e.ProjectID === projectId) && (!from && !to ? true : inRange(e.ExpenseDate));
  });
  var heads = readAll_('ExpenseHeads');
  var byCategory = {};
  expenses.forEach(function (e) {
    var head = heads.filter(function (h) { return h.ExpHeadID === e.ExpHeadID; })[0];
    var cat = head ? (head.Category || 'Other') : 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.TotalAmount || 0);
  });
  var income = {
    contract: sum_(contracts.filter(function (c) { return c.ContractType === 'Contract'; }), 'ContractValue'),
    lpo: sum_(contracts.filter(function (c) { return c.ContractType === 'LPO'; }), 'ContractValue'),
    salesInvoice: sum_(contracts.filter(function (c) { return c.ContractType === 'Sales Invoice'; }), 'ContractValue')
  };
  var totalIncome = income.contract + income.lpo + income.salesInvoice;
  var totalExpenses = sum_(expenses, 'TotalAmount');
  return {
    income: income, totalIncome: totalIncome,
    expensesByCategory: byCategory, totalExpenses: totalExpenses,
    netProfit: round2_(totalIncome - totalExpenses),
    margin: totalIncome > 0 ? round2_((totalIncome - totalExpenses) / totalIncome * 100) : 0
  };
}

function getSupplierWiseReport_(projectId, supplierId, dateFrom, dateTo) {
  var from = dateFrom ? new Date(dateFrom) : null;
  var to = dateTo ? new Date(dateTo) : null;
  var expenses = readAll_('ActualExpenses').filter(function (e) {
    if (projectId && e.ProjectID !== projectId) return false;
    if (supplierId && e.SupplierID !== supplierId) return false;
    var d = new Date(e.ExpenseDate);
    if (from && (isNaN(d.getTime()) || d < from)) return false;
    if (to && (isNaN(d.getTime()) || d > to)) return false;
    return true;
  });
  var bySupplier = {};
  expenses.forEach(function (e) {
    var s = bySupplier[e.SupplierID] = bySupplier[e.SupplierID] || { supplierId: e.SupplierID, entries: 0, totalQty: 0, totalAmount: 0 };
    s.entries += 1;
    s.totalQty += Number(e.Quantity || 0);
    s.totalAmount += Number(e.TotalAmount || 0);
  });
  return { summary: Object.keys(bySupplier).map(function (k) { return bySupplier[k]; }), details: expenses };
}

// ============ MISC HELPERS ============
function sum_(rows, field) {
  var t = 0;
  for (var i = 0; i < rows.length; i++) t += Number(rows[i][field] || 0);
  return round2_(t);
}

function round2_(n) { return Math.round(Number(n) * 100) / 100; }

function nowStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function formatCurrency(n) {
  var num = Number(n || 0);
  var parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return 'MK ' + parts.join('.');
}
