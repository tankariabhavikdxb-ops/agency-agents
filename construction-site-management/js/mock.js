/* ============================================================
   NEXORA CMS — DEMO backend (in-browser, localStorage)
   ------------------------------------------------------------
   Mirrors the business rules of backend/Code.gs exactly, so the
   app is fully usable before Google Sheets is connected:
   • strict control: expenses only against APPROVED budget lines
   • over-budget entries blocked (or override by Admin when
     "Allow budget override" is enabled in Settings)
   • duplicate entry checks on every entity
   • audit trail + version counter for real-time sync
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt;
  const KEY = "nexora_cms_db_v1";
  const EPS = 0.005;

  /* ---------------- permissions ---------------- */
  const PERMS = {
    Admin: { settings: true, users: true, masters: true, edit: true, delete: true, create: true, override: true },
    Supervisor: { settings: false, users: false, masters: true, edit: true, delete: true, create: true, override: false },
    Clerk: { settings: false, users: false, masters: false, edit: false, delete: false, create: true, override: false },
  };
  function can(user, perm) {
    const p = PERMS[user && user.role] || PERMS.Clerk;
    return !!p[perm];
  }

  /* ---------------- seed data ---------------- */
  function seed() {
    const t = () => F.nowStamp();
    const d = (n) => {
      const dt = new Date(2026, 7, 20);
      dt.setDate(dt.getDate() - n);
      return dt.toISOString().slice(0, 10);
    };
    const row = (obj) => Object.assign({ createdBy: "System", createdAt: t(), updatedBy: "", updatedAt: "" }, obj);

    const settings = {
      companyName: "Nexora Limited",
      companyAddress: "Corporate Mall, 1st Floor, Office Block B, Chilambula Road, Lilongwe, Malawi",
      companyPhone: "+265 1 700 000",
      companyEmail: "info@nexora.mw",
      currency: "MK",
      defaultVAT: 16.5,
      allowOverBudget: "YES", // demo shows the override flow; set NO in Settings for strictest control
      pollInterval: 45,
    };

    const users = [
      { id: "U-1", name: "Prashant Khatri", role: "Admin", pin: "1234", active: "YES", createdAt: t() },
      { id: "U-2", name: "Shakeel Patel", role: "Admin", pin: "1234", active: "YES", createdAt: t() },
      { id: "U-3", name: "Bhavik Tankaria", role: "Admin", pin: "1234", active: "YES", createdAt: t() },
      { id: "U-4", name: "Tanjani Malima", role: "Admin", pin: "1234", active: "YES", createdAt: t() },
      { id: "U-5", name: "Davie Chavula", role: "Admin", pin: "1234", active: "YES", createdAt: t() },
    ];

    const units = [
      ["U1", "Bag (50 kg)", "bag50"], ["U2", "Bag (25 kg)", "bag25"], ["U3", "Tonne", "t"], ["U4", "Kilogram", "kg"],
      ["U5", "Cubic Metre", "m³"], ["U6", "Square Metre", "m²"], ["U7", "Metre (linear)", "m"], ["U8", "Litre", "L"],
      ["U9", "Sheet", "sht"], ["U10", "Roll", "roll"], ["U11", "Piece", "pcs"], ["U12", "Trip / Load", "trip"],
      ["U13", "Lump Sum", "ls"], ["U14", "Man-Day", "md"], ["U15", "Hour", "hr"], ["U16", "Month", "mo"],
    ].map(([id, name, ab]) => row({ id, name, abbrev: ab, status: "Active", remarks: "" }));

    const heads = [
      ["H1", "Materials", "Direct"], ["H2", "Labour", "Labour"], ["H3", "Plant & Equipment Hire", "Equipment"],
      ["H4", "Subcontract Works", "Subcontract"], ["H5", "Transport & Haulage", "Direct"], ["H6", "Fuel & Lubricants", "Overhead"],
      ["H7", "Site Overheads", "Overhead"], ["H8", "Professional Fees", "Overhead"], ["H9", "Safety & Welfare", "Overhead"],
      ["H10", "Contingency", "Other"],
    ].map(([id, name, category]) => row({ id, name, category, status: "Active", remarks: "" }));

    const materials = [
      ["M1", "Portland Cement 42.5R (OPC)", "Construction Materials", "U1", 17500],
      ["M2", "Portland Cement 32.5N (PPC)", "Construction Materials", "U1", 16800],
      ["M3", "River Sand (washed)", "Aggregates", "U5", 28000],
      ["M4", "Crushed Stone 20mm", "Aggregates", "U5", 65000],
      ["M5", "Quarry Dust", "Aggregates", "U5", 32000],
      ["M6", "Aggregate 10mm", "Aggregates", "U5", 58000],
      ["M7", "Reinforcement Steel Y12 (12mm)", "Steel", "U3", 1050000],
      ["M8", "Reinforcement Steel Y16 (16mm)", "Steel", "U3", 1030000],
      ["M9", "Binding Wire", "Steel", "U4", 2900],
      ["M10", "BRC Mesh A142 (2.4m x 4.8m)", "Steel", "U9", 68000],
      ["M11", "Burnt Clay Bricks", "Masonry", "U11", 380],
      ["M12", "Concrete Blocks 150mm", "Masonry", "U11", 950],
      ["M13", "Timber 2x4 (3.0m)", "Timber", "U11", 8500],
      ["M14", "Plywood 18mm (8x4)", "Timber", "U9", 42000],
      ["M15", "IBR Roofing Sheets (3.0m)", "Roofing", "U9", 27500],
      ["M16", "Roofing Ridge Caps", "Roofing", "U9", 7800],
      ["M17", "Nails 100mm", "Fixings", "U4", 2400],
      ["M18", "Emulsion Paint", "Finishes", "U8", 6200],
      ["M19", "Gloss Paint", "Finishes", "U8", 8400],
      ["M20", "PVC Pipes 50mm (6m)", "Plumbing", "U11", 21000],
      ["M21", "Electrical Cable 2.5mm² (100m)", "Electrical", "U10", 185000],
      ["M22", "Ceramic Floor Tiles 600x600", "Finishes", "U6", 34000],
      ["M23", "Gypsum Board 12mm", "Finishes", "U9", 18500],
      ["M24", "Water (bowser)", "Services", "U8", 120],
      ["M25", "Diesel", "Fuel", "U8", 2850],
      ["M26", "Formwork Oil", "Consumables", "U8", 4600],
      ["M27", "Skilled Labour (Craft)", "Labour", "U14", 22500],
      ["M28", "General Labour", "Labour", "U14", 9500],
      ["M29", "Excavator Hire (CAT 320)", "Plant Hire", "U15", 145000],
      ["M30", "Tipper Truck Hire (10m³)", "Plant Hire", "U12", 85000],
      ["M31", "Crane Hire (25T)", "Plant Hire", "U15", 260000],
      ["M32", "Site Security Services", "Overheads", "U16", 1450000],
      ["M33", "Scaffolding Hire", "Plant Hire", "U16", 3800000],
      ["M34", "Site Electricity & Water", "Overheads", "U16", 850000],
      ["M35", "Site Office Rent", "Overheads", "U16", 1200000],
      ["M36", "PPE & Safety Gear", "Overheads", "U13", 4500000],
      ["M37", "Miscellaneous Consumables", "Consumables", "U13", 3200000],
      ["M38", "Professional Fees (Consultant)", "Fees", "U13", 12000000],
    ].map(([id, name, category, unit, rate]) => row({ id, name, category, unit, standardRate: rate, status: "Active", remarks: "" }));

    const suppliers = [
      ["S1", "Chipiku Building Supplies", "Mr. Chipiku", "+265 999 100 001", "orders@chipiku.mw", "Lilongwe Old Town", "TPIN-100001"],
      ["S2", "Lilongwe Hardware Centre", "Ms. Nyirenda", "+265 999 100 002", "sales@lhc.mw", "City Centre, Lilongwe", "TPIN-100002"],
      ["S3", "NBS Steel & Hardware", "Mr. Mwale", "+265 999 100 003", "nbs@steel.mw", "Kanengo Industrial Area", "TPIN-100003"],
      ["S4", "Malawi Timber Industries", "Mr. Banda", "+265 999 100 004", "info@mti.mw", "Area 25, Lilongwe", "TPIN-100004"],
      ["S5", "Zaka Aggregates & Quarry", "Mr. Zaka", "+265 999 100 005", "zaka@quarry.mw", "Lumbadzi", "TPIN-100005"],
      ["S6", "Capital Paints & Chemicals", "Ms. Phiri", "+265 999 100 006", "capital@paints.mw", "City Centre, Lilongwe", "TPIN-100006"],
      ["S7", "Fuel Express Filling Station", "Station Manager", "+265 999 100 007", "fuel@express.mw", "Kamuzu Procession Road", "TPIN-100007"],
      ["S8", "Buildman Electrical & Plumbing", "Mr. Gondwe", "+265 999 100 008", "buildman@ep.mw", "Old Town, Lilongwe", "TPIN-100008"],
    ].map(([id, name, contactPerson, phone, email, address, tin]) => row({ id, name, contactPerson, phone, email, address, tin, status: "Active", remarks: "" }));

    const customers = [
      ["C1", "Lilongwe Water Board", "The Procurement Manager", "+265 1 755 555", "procurement@lwb.mw", "Likuni, Lilongwe", "TPIN-200001"],
      ["C2", "Press Corporation Ltd", "Head of Estates", "+265 1 820 000", "estates@presscorp.mw", "Gen. Glynn Jones Road, Blantyre", "TPIN-200002"],
      ["C3", "Malawi Housing Corporation", "Director of Projects", "+265 1 777 888", "projects@mhc.mw", "Area 3, Lilongwe", "TPIN-200003"],
      ["C4", "CDH Investment Bank", "Property Manager", "+265 1 833 000", "property@cdh.mw", "City Centre, Lilongwe", "TPIN-200004"],
      ["C5", "Roads Authority", "Chief Engineer", "+265 1 750 600", "ce@ra.mw", "Capital Hill, Lilongwe", "TPIN-200005"],
      ["C6", "Sunbird Hotels Ltd", "Maintenance Manager", "+265 1 774 388", "maintenance@sunbird.mw", "Victoria Avenue, Blantyre", "TPIN-200006"],
    ].map(([id, name, contactPerson, phone, email, address, tin]) => row({ id, name, contactPerson, phone, email, address, tin, status: "Active", remarks: "" }));

    const shops = [
      ["SH1", "Head Office Store", "Kanengo, Lilongwe", "Bhavik Tankaria"],
      ["SH2", "Area 18 Site Store", "Area 18, Lilongwe", "Shakeel Patel"],
      ["SH3", "Kanengo Yard", "Kanengo Industrial Area", "Tanjani Malima"],
      ["SH4", "Bwaila Site Store", "Bwaila, Lilongwe", "Davie Chavula"],
      ["SH5", "Gateway Mall Site Store", "City Centre, Lilongwe", "Prashant Khatri"],
      ["SH6", "Mchinji Road Depot", "Mchinji", "Davie Chavula"],
    ].map(([id, name, location, supervisor]) => row({ id, name, location, supervisor, status: "Active", remarks: "" }));

    const projects = [
      { id: "P1", code: "NX-2026-001", name: "Lilongwe Water Board — Head Office Refurbishment", client: "Lilongwe Water Board", location: "Likuni, Lilongwe", startDate: "2026-01-05", endDate: "2026-12-18", manager: "Bhavik Tankaria", status: "Active", remarks: "Refurbishment of 4-storey head office block." },
      { id: "P2", code: "NX-2026-002", name: "Gateway Mall Extension — Phase 2", client: "Press Corporation Ltd", location: "City Centre, Lilongwe", startDate: "2026-02-02", endDate: "2027-01-29", manager: "Prashant Khatri", status: "Active", remarks: "Extension wing + new parking deck." },
      { id: "P3", code: "NX-2026-003", name: "Bwaila Staff Housing — 12 Units", client: "Malawi Housing Corporation", location: "Bwaila, Lilongwe", startDate: "2026-03-16", endDate: "2026-11-30", manager: "Shakeel Patel", status: "Active", remarks: "12 staff houses, 3-bedroom duplex type." },
      { id: "P4", code: "NX-2025-014", name: "Kanengo Warehouse & Yard Works", client: "CDH Investment Bank", location: "Kanengo, Lilongwe", startDate: "2025-08-01", endDate: "2026-03-31", manager: "Tanjani Malima", status: "Completed", remarks: "Warehouse floor, drainage and boundary wall." },
      { id: "P5", code: "NX-2026-005", name: "Mchinji Road Culvert Repairs", client: "Roads Authority", location: "Mchinji", startDate: "2026-05-04", endDate: "2026-10-30", manager: "Davie Chavula", status: "On Hold", remarks: "Culvert repairs — awaiting permits." },
    ].map(p => row(p));

    // budget lines: [id, project, head, material, shop, qty, rate]
    const B = (id, projectId, headId, materialId, shopId, qty, rate, status) =>
      row({ id, projectId, headId, materialId, shopId, unitId: byU(materialId), qty, rate, amount: Math.round(qty * rate), status: status || "Approved", notes: "" });
    const byU = mid => { const m = materials.find(x => x.id === mid); return m ? m.unit : "U11"; };

    const budget = [
      B("B01", "P1", "H1", "M1", "SH1", 4200, 17500),
      B("B02", "P1", "H1", "M3", "SH1", 850, 28000),
      B("B03", "P1", "H1", "M4", "SH1", 640, 65000),
      B("B04", "P1", "H1", "M7", "SH3", 96, 1050000),
      B("B05", "P1", "H1", "M8", "SH3", 58, 1030000),
      B("B06", "P1", "H1", "M11", "SH2", 120000, 380),
      B("B07", "P1", "H1", "M12", "SH2", 18000, 950),
      B("B08", "P1", "H1", "M13", "SH2", 2400, 8500),
      B("B09", "P1", "H1", "M14", "SH2", 620, 42000),
      B("B10", "P1", "H1", "M15", "SH2", 900, 27500),
      B("B11", "P1", "H1", "M18", "SH2", 320, 6200),
      B("B12", "P1", "H1", "M19", "SH2", 160, 8400),
      B("B13", "P1", "H1", "M20", "SH2", 260, 21000),
      B("B14", "P1", "H1", "M21", "SH2", 18, 185000),
      B("B15", "P1", "H1", "M22", "SH2", 1450, 34000),
      B("B16", "P1", "H1", "M23", "SH2", 900, 18500),
      B("B17", "P1", "H2", "M27", "SH1", 4800, 22500),
      B("B18", "P1", "H2", "M28", "SH1", 6200, 9500),
      B("B19", "P1", "H3", "M29", "SH3", 320, 145000),
      B("B20", "P1", "H5", "M30", "SH3", 520, 85000),
      B("B21", "P1", "H9", "M32", "SH1", 9, 1450000),
      B("B22", "P1", "H6", "M25", "SH1", 3800, 2850),
      B("B23", "P2", "H1", "M1", "SH5", 5600, 17500),
      B("B24", "P2", "H1", "M4", "SH5", 1100, 65000),
      B("B25", "P2", "H1", "M7", "SH3", 185, 1050000),
      B("B26", "P2", "H1", "M10", "SH5", 420, 68000),
      B("B27", "P2", "H1", "M15", "SH5", 1450, 27500),
      B("B28", "P2", "H2", "M27", "SH5", 7200, 22500),
      B("B29", "P2", "H3", "M31", "SH3", 260, 260000),
      B("B30", "P2", "H3", "M33", "SH5", 10, 3800000),
      B("B31", "P2", "H9", "M36", "SH5", 1, 4500000),
      B("B32", "P2", "H6", "M25", "SH5", 5200, 2850),
      B("B33", "P3", "H1", "M1", "SH4", 3600, 17500),
      B("B34", "P3", "H1", "M11", "SH4", 96000, 380),
      B("B35", "P3", "H1", "M12", "SH4", 14000, 950),
      B("B36", "P3", "H1", "M7", "SH3", 88, 1050000),
      B("B37", "P3", "H1", "M15", "SH4", 760, 27500),
      B("B38", "P3", "H2", "M28", "SH4", 8800, 9500),
      B("B39", "P3", "H7", "M35", "SH4", 8, 1200000),
      B("B40", "P3", "H7", "M34", "SH4", 8, 850000),
      B("B41", "P3", "H6", "M25", "SH4", 2400, 2850),
      B("B42", "P4", "H1", "M1", "SH1", 2600, 17000),
      B("B43", "P4", "H1", "M4", "SH1", 980, 62000),
      B("B44", "P4", "H1", "M8", "SH3", 44, 1010000),
      B("B45", "P4", "H2", "M27", "SH1", 2100, 21000),
      B("B46", "P4", "H5", "M30", "SH3", 260, 82000),
      B("B47", "P5", "H1", "M1", "SH6", 900, 17500),
      B("B48", "P5", "H1", "M4", "SH6", 320, 65000),
      B("B49", "P5", "H1", "M7", "SH6", 22, 1050000),
      B("B50", "P5", "H4", "M38", "SH6", 1, 6500000),
    ];

    const contracts = [];
    const C = (id, type, refNo, date, projectId, customerId, supplierId, description, amount, vatRate, status, paymentStatus) => {
      const vatAmount = Math.round(amount * vatRate / 100);
      contracts.push(row({
        id, type, refNo, date,
        direction: type === "LPO" ? "Expense" : "Income",
        projectId, customerId, supplierId, description,
        amount, vatRate, vatAmount, total: amount + vatAmount,
        status, paymentStatus, remarks: "",
      }));
    };
    C("CT1", "Contract Value", "CV-2026-001", "2026-01-05", "P1", "C1", "", "Head office refurbishment contract", 485000000, 16.5, "In Progress", "Unpaid");
    C("CT2", "Contract Value", "CV-2026-002", "2026-02-02", "P2", "C2", "", "Gateway Mall extension phase 2", 720000000, 16.5, "In Progress", "Unpaid");
    C("CT3", "Contract Value", "CV-2026-003", "2026-03-16", "P3", "C3", "", "12-unit staff housing", 540000000, 16.5, "In Progress", "Unpaid");
    C("CT4", "Contract Value", "CV-2025-014", "2025-08-01", "P4", "C4", "", "Warehouse & yard works", 260000000, 16.5, "Completed", "Paid");
    C("CT5", "Contract Value", "CV-2026-005", "2026-05-04", "P5", "C5", "", "Culvert repairs", 95000000, 16.5, "Awarded", "Unpaid");
    C("CT6", "Sales Invoice", "INV-2026-001", "2026-03-31", "P1", "C1", "", "IPC No.1 — substructure complete", 120000000, 16.5, "Issued", "Paid");
    C("CT7", "Sales Invoice", "INV-2026-002", "2026-04-30", "P2", "C2", "", "IPC No.1 — ground floor slab", 180000000, 16.5, "Issued", "Paid");
    C("CT8", "Sales Invoice", "INV-2026-003", "2026-05-31", "P3", "C3", "", "IPC No.1 — foundations", 135000000, 16.5, "Issued", "Partially Paid");
    C("CT9", "Sales Invoice", "INV-2026-004", "2026-06-30", "P1", "C1", "", "IPC No.2 — superstructure", 96000000, 16.5, "Issued", "Partially Paid");
    C("CT10", "Sales Invoice", "INV-2026-005", "2026-07-31", "P2", "C2", "", "IPC No.2 — first floor", 144000000, 16.5, "Issued", "Unpaid");
    C("CT11", "Sales Invoice", "INV-2026-006", "2026-07-31", "P3", "C3", "", "IPC No.2 — walls", 108000000, 16.5, "Issued", "Unpaid");
    C("CT12", "Sales Invoice", "INV-2025-018", "2025-12-15", "P4", "C4", "", "Final certificate", 78000000, 16.5, "Issued", "Paid");
    C("CT13", "LPO", "LPO-2026-001", "2026-01-10", "P1", "", "S1", "2,400 bags OPC cement", 42000000, 0, "Received", "Paid");
    C("CT14", "LPO", "LPO-2026-002", "2026-01-15", "P1", "", "S3", "120 t reinforcement steel Y12/Y16", 124000000, 0, "Partially Received", "Partially Paid");
    C("CT15", "LPO", "LPO-2026-003", "2026-02-20", "P2", "", "S5", "Crushed stone & quarry dust", 71500000, 0, "Received", "Paid");
    C("CT16", "LPO", "LPO-2026-004", "2026-03-05", "P3", "", "S1", "Cement & blocks for housing", 38000000, 0, "Open", "Unpaid");
    C("CT17", "LPO", "LPO-2026-005", "2026-04-12", "P2", "", "S6", "Paint & finishes", 9400000, 0, "Partially Received", "Unpaid");
    C("CT18", "LPO", "LPO-2026-006", "2026-05-08", "P1", "", "S8", "Electrical & plumbing supplies", 21400000, 0, "Open", "Unpaid");

    // expenses: [id, budgetId, date, shopId, supplierId, invoiceNo, qty, rate, paymentStatus, enteredBy]
    const X = (id, budgetId, date, supplierId, invoiceNo, qty, rate, paymentStatus, enteredBy, override, reason) => {
      const bl = budget.find(b => b.id === budgetId);
      const m = materials.find(m => m.id === bl.materialId);
      expenses.push(row({
        id, projectId: bl.projectId, budgetId, date, shopId: bl.shopId, supplierId,
        invoiceNo, headId: bl.headId, materialId: bl.materialId, unitId: m.unit,
        qty, rate, amount: Math.round(qty * rate),
        paymentStatus, override: override || "NO", overrideReason: reason || "",
        remarks: "", createdBy: enteredBy, updatedBy: "", updatedAt: "",
      }));
    };
    const expenses = [];
    X("E01", "B01", d(215), "S1", "CBS-2026-0142", 600, 17500, "Paid", "Bhavik Tankaria");
    X("E02", "B01", d(180), "S1", "CBS-2026-0210", 700, 17600, "Paid", "Bhavik Tankaria");
    X("E03", "B01", d(150), "S1", "CBS-2026-0298", 550, 17500, "Paid", "Davie Chavula");
    X("E04", "B01", d(120), "S2", "LHC-2026-1011", 500, 17550, "Paid", "Tanjani Malima");
    X("E05", "B01", d(85), "S1", "CBS-2026-0412", 650, 17500, "Paid", "Bhavik Tankaria");
    X("E06", "B01", d(50), "S1", "CBS-2026-0550", 600, 17600, "Partially Paid", "Prashant Khatri");
    X("E07", "B02", d(190), "S5", "ZAQ-2026-0077", 260, 28000, "Paid", "Bhavik Tankaria");
    X("E08", "B02", d(140), "S5", "ZAQ-2026-0133", 220, 28500, "Paid", "Tanjani Malima");
    X("E09", "B02", d(60), "S5", "ZAQ-2026-0219", 180, 28000, "Unpaid", "Davie Chavula");
    X("E10", "B03", d(160), "S5", "ZAQ-2026-0108", 300, 65000, "Paid", "Bhavik Tankaria");
    X("E11", "B03", d(95), "S5", "ZAQ-2026-0176", 220, 66000, "Partially Paid", "Tanjani Malima");
    X("E12", "B04", d(170), "S3", "NBS-2026-0045", 40, 1050000, "Paid", "Bhavik Tankaria");
    X("E13", "B04", d(110), "S3", "NBS-2026-0092", 38, 1060000, "Partially Paid", "Tanjani Malima");
    X("E14", "B05", d(130), "S3", "NBS-2026-0104", 30, 1030000, "Partially Paid", "Bhavik Tankaria");
    X("E15", "B06", d(155), "S2", "LHC-2026-0871", 45000, 380, "Paid", "Davie Chavula");
    X("E16", "B06", d(90), "S2", "LHC-2026-1134", 40000, 385, "Paid", "Davie Chavula");
    X("E17", "B07", d(125), "S2", "LHC-2026-0955", 8000, 950, "Paid", "Shakeel Patel");
    X("E18", "B08", d(115), "S4", "MTI-2026-0331", 1100, 8500, "Paid", "Shakeel Patel");
    X("E19", "B09", d(100), "S4", "MTI-2026-0398", 280, 42000, "Paid", "Shakeel Patel");
    X("E20", "B10", d(80), "S3", "NBS-2026-0155", 420, 27500, "Partially Paid", "Shakeel Patel");
    X("E21", "B15", d(70), "S2", "LHC-2026-1344", 650, 34000, "Unpaid", "Shakeel Patel");
    X("E22", "B17", d(45), "S1", "PAY-2026-06", 620, 22500, "Paid", "Prashant Khatri");
    X("E23", "B17", d(15), "S1", "PAY-2026-07", 640, 22500, "Partially Paid", "Prashant Khatri");
    X("E24", "B18", d(45), "S1", "PAY-2026-06", 780, 9500, "Paid", "Prashant Khatri");
    X("E25", "B18", d(15), "S1", "PAY-2026-07", 800, 9500, "Paid", "Prashant Khatri");
    X("E26", "B19", d(135), "S5", "ZAK-2026-0122", 120, 145000, "Paid", "Bhavik Tankaria");
    X("E27", "B20", d(105), "S5", "ZAK-2026-0150", 160, 85000, "Paid", "Bhavik Tankaria");
    X("E28", "B21", d(30), "S2", "SEC-2026-04", 3, 1450000, "Paid", "Tanjani Malima");
    X("E29", "B22", d(20), "S7", "FEX-2026-0088", 950, 2850, "Paid", "Davie Chavula");
    X("E30", "B22", d(5), "S7", "FEX-2026-0112", 1000, 2900, "Unpaid", "Davie Chavula");
    X("E31", "B23", d(150), "S1", "CBS-2026-0315", 1500, 17500, "Paid", "Prashant Khatri");
    X("E32", "B23", d(90), "S1", "CBS-2026-0480", 1400, 17600, "Partially Paid", "Prashant Khatri");
    X("E33", "B24", d(120), "S5", "ZAQ-2026-0188", 500, 65000, "Paid", "Prashant Khatri");
    X("E34", "B25", d(100), "S3", "NBS-2026-0123", 75, 1050000, "Partially Paid", "Prashant Khatri");
    X("E35", "B26", d(85), "S3", "NBS-2026-0160", 180, 68000, "Unpaid", "Shakeel Patel");
    X("E36", "B27", d(75), "S3", "NBS-2026-0177", 500, 27500, "Unpaid", "Shakeel Patel");
    X("E37", "B28", d(60), "S2", "PAY-2026-05", 900, 22500, "Paid", "Prashant Khatri");
    X("E38", "B28", d(30), "S2", "PAY-2026-06", 920, 22500, "Paid", "Prashant Khatri");
    X("E39", "B29", d(95), "S5", "ZAK-2026-0201", 90, 260000, "Paid", "Bhavik Tankaria");
    X("E40", "B30", d(40), "S2", "SCA-2026-003", 3, 3800000, "Partially Paid", "Bhavik Tankaria");
    X("E41", "B32", d(25), "S7", "FEX-2026-0101", 1400, 2850, "Paid", "Bhavik Tankaria");
    X("E42", "B33", d(140), "S1", "CBS-2026-0355", 1000, 17500, "Paid", "Shakeel Patel");
    X("E43", "B34", d(110), "S2", "LHC-2026-1022", 40000, 380, "Paid", "Shakeel Patel");
    X("E44", "B35", d(80), "S2", "LHC-2026-1189", 6500, 950, "Paid", "Shakeel Patel");
    X("E45", "B36", d(70), "S3", "NBS-2026-0148", 34, 1050000, "Partially Paid", "Shakeel Patel");
    X("E46", "B38", d(55), "S1", "PAY-2026-05", 1200, 9500, "Paid", "Shakeel Patel");
    X("E47", "B38", d(20), "S1", "PAY-2026-06", 1250, 9500, "Partially Paid", "Shakeel Patel");
    X("E48", "B41", d(15), "S7", "FEX-2026-0115", 800, 2850, "Unpaid", "Shakeel Patel");
    X("E49", "B42", d(240), "S1", "CBS-2025-1180", 900, 17000, "Paid", "Tanjani Malima");
    X("E50", "B42", d(200), "S1", "CBS-2025-1255", 850, 17100, "Paid", "Tanjani Malima");
    X("E51", "B43", d(210), "S5", "ZAQ-2025-0311", 420, 62000, "Paid", "Tanjani Malima");
    X("E52", "B44", d(180), "S3", "NBS-2025-0222", 20, 1010000, "Paid", "Tanjani Malima");
    X("E53", "B45", d(150), "S1", "PAY-2025-10", 700, 21000, "Paid", "Tanjani Malima");
    X("E54", "B45", d(120), "S1", "PAY-2025-11", 720, 21000, "Paid", "Davie Chavula");
    X("E55", "B46", d(130), "S5", "ZAK-2025-0277", 90, 82000, "Paid", "Davie Chavula");
    // one over-budget line with Admin override (shows the strict-control flow)
    X("E56", "B17", d(3), "S1", "PAY-2026-08", 500, 22500, "Unpaid", "Prashant Khatri", "YES", "Additional manpower approved by Project Manager");
    X("E57", "B47", d(10), "S1", "CBS-2026-0601", 300, 17500, "Unpaid", "Davie Chavula");

    const audit = [
      { ts: t(), user: "Bhavik Tankaria", action: "LOGIN", entity: "System", ref: "Bhavik Tankaria", details: "Signed in" },
      { ts: t(), user: "Prashant Khatri", action: "CREATE", entity: "Expense", ref: "PAY-2026-08", details: "Labour expense with budget override" },
      { ts: t(), user: "Shakeel Patel", action: "CREATE", entity: "Contract", ref: "INV-2026-006", details: "Sales invoice issued for Bwaila Staff Housing" },
      { ts: t(), user: "Davie Chavula", action: "UPDATE", entity: "Budget", ref: "B47", details: "Budget line adjusted" },
    ];

    return {
      settings, users,
      masters: { Projects: projects, Shops: shops, ExpenseHeads: heads, Materials: materials, Units: units, Suppliers: suppliers, Customers: customers },
      budget, contracts, expenses, audit,
      version: 1, seq: 1000,
    };
  }

  /* ---------------- storage ---------------- */
  function MockDB(storage) {
    this.storage = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    let db = null;
    try {
      const raw = this.storage && this.storage.getItem(KEY);
      db = raw ? JSON.parse(raw) : null;
    } catch (e) { db = null; }
    if (!db || !db.settings) {
      db = seed();
      this.persist(db);
    }
    this.db = db;
  }

  MockDB.prototype.persist = function (db) {
    if (!this.storage) return;
    try { this.storage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* quota */ }
  };

  MockDB.prototype.bump = function () {
    this.db.version++;
    this.persist(this.db);
  };

  MockDB.prototype.audit = function (user, action, entity, ref, details) {
    this.db.audit.unshift({ ts: F.nowStamp(), user: user || "System", action, entity, ref: ref || "", details: details || "" });
    if (this.db.audit.length > 600) this.db.audit.length = 600;
  };

  MockDB.prototype.nextId = function (p) {
    return F.uid(p || "ID");
  };

  /* ---------------- shared business rules ---------------- */
  const MASTER_SHEETS = ["Projects", "Shops", "ExpenseHeads", "Materials", "Units", "Suppliers", "Customers"];

  function err(code, message, field) {
    return { ok: false, error: { code, message, field: field || "" } };
  }

  function masterDupError(sheet, data, selfId, db) {
    const list = db.masters[sheet] || [];
    const name = String(data.name || "").trim().toLowerCase();
    if (!name) return err("REQUIRED", "Name is required", "name");
    const dup = list.find(r => r.id !== selfId && String(r.name).trim().toLowerCase() === name);
    if (dup) return err("DUPLICATE", `${sheet.slice(0, -1)} "${data.name}" already exists — duplicate entries are not allowed.`, "name");
    if (sheet === "Projects") {
      const code = String(data.code || "").trim().toUpperCase();
      if (!code) return err("REQUIRED", "Project code is required", "code");
      const dupC = list.find(r => r.id !== selfId && String(r.code).trim().toUpperCase() === code);
      if (dupC) return err("DUPLICATE", `Project code "${code}" is already used by "${dupC.name}".`, "code");
    }
    if (sheet === "Units") {
      const ab = String(data.abbrev || "").trim().toLowerCase();
      if (ab) {
        const dupA = list.find(r => r.id !== selfId && String(r.abbrev).trim().toLowerCase() === ab);
        if (dupA) return err("DUPLICATE", `Unit abbreviation "${data.abbrev}" already exists.`, "abbrev");
      }
    }
    return null;
  }

  function budgetConsumed(db, budgetId) {
    return (db.expenses || []).filter(e => e.budgetId === budgetId)
      .reduce((a, e) => ({ qty: a.qty + F.num(e.qty), amount: a.amount + F.num(e.amount) }), { qty: 0, amount: 0 });
  }

  function validateBudgetLine(db, data, selfId) {
    if (!data.projectId) return err("REQUIRED", "Project is required", "projectId");
    if (!data.headId) return err("REQUIRED", "Expense head is required", "headId");
    if (!data.materialId) return err("REQUIRED", "Material is required", "materialId");
    if (!data.shopId) return err("REQUIRED", "Shop is required", "shopId");
    if (F.num(data.qty) <= 0) return err("INVALID", "Quantity must be greater than zero", "qty");
    if (F.num(data.rate) <= 0) return err("INVALID", "Rate must be greater than zero", "rate");
    if (!["Approved", "Hold"].includes(data.status)) data.status = "Approved";

    const self = selfId ? F.byId(db.budget, selfId) : null;
    if (self) {
      const consumed = budgetConsumed(db, selfId);
      const locked = ["projectId", "headId", "materialId", "shopId", "unitId"];
      for (const k of locked) {
        if (String(data[k]) !== String(self[k])) {
          return err("LOCKED", "This budget line already has expenses against it — its project, head, material, shop and unit cannot be changed.", k);
        }
      }
      if (F.num(data.qty) < consumed.qty - EPS) return err("INVALID", `Quantity cannot be below already consumed ${F.qty(consumed.qty)}.`, "qty");
      if (F.num(data.qty) * F.num(data.rate) < consumed.amount - EPS) return err("INVALID", `Amount cannot be below already consumed ${F.money(consumed.amount)}.`, "rate");
    } else {
      const dup = db.budget.find(b =>
        b.projectId === data.projectId && b.headId === data.headId && b.materialId === data.materialId && b.shopId === data.shopId);
      if (dup) return err("DUPLICATE", "This exact budget line (project + head + material + shop) already exists — duplicate budget lines are not allowed.", "materialId");
    }
    return null;
  }

  const CONTRACT_TYPES = {
    "Contract Value": ["Awarded", "In Progress", "Completed", "Terminated"],
    "Sales Invoice": ["Issued", "Cancelled"],
    "LPO": ["Open", "Partially Received", "Received", "Cancelled"],
  };

  function validateContract(db, data, selfId) {
    if (!CONTRACT_TYPES[data.type]) return err("INVALID", "Document type is required", "type");
    if (!String(data.refNo || "").trim()) return err("REQUIRED", "Reference number is required", "refNo");
    if (!data.date) return err("REQUIRED", "Date is required", "date");
    if (!data.projectId) return err("REQUIRED", "Project is required", "projectId");
    if (F.num(data.amount) <= 0) return err("INVALID", "Amount must be greater than zero", "amount");
    const direction = data.type === "LPO" ? "Expense" : "Income";
    if (direction === "Income" && !data.customerId) return err("REQUIRED", "Customer is required for contracts and invoices", "customerId");
    if (direction === "Expense" && !data.supplierId) return err("REQUIRED", "Supplier is required for LPOs", "supplierId");
    if (!CONTRACT_TYPES[data.type].includes(data.status)) return err("INVALID", `Invalid status for ${data.type}`, "status");
    const dup = db.contracts.find(c => c.id !== selfId && c.type === data.type && String(c.refNo).trim().toUpperCase() === String(data.refNo).trim().toUpperCase());
    if (dup) return err("DUPLICATE", `${data.type} "${data.refNo}" already exists — reference numbers must be unique.`, "refNo");
    return null;
  }

  function validateExpense(db, data, selfId, settings, user) {
    // STRICT CONTROL — the expense MUST be against an existing, approved budget line
    if (!data.projectId) return err("REQUIRED", "Project is required", "projectId");
    if (!data.budgetId) return err("REQUIRED", "Budget line is required — expenses can only be entered against budgeted items.", "budgetId");
    const bl = F.byId(db.budget, data.budgetId);
    if (!bl) return err("INVALID", "Selected budget line no longer exists. Please refresh and select again.", "budgetId");
    if (bl.projectId !== data.projectId) return err("INVALID", "The selected budget line does not belong to this project.", "budgetId");
    if (bl.status !== "Approved") return err("INVALID", `This budget line is on "${bl.status}" — expenses can only be posted against APPROVED budget lines.`, "budgetId");
    if (!data.date) return err("REQUIRED", "Date is required", "date");
    if (!data.supplierId) return err("REQUIRED", "Supplier is required", "supplierId");
    if (F.num(data.qty) <= 0) return err("INVALID", "Quantity must be greater than zero", "qty");
    if (F.num(data.rate) <= 0) return err("INVALID", "Rate must be greater than zero", "rate");

    const qty = F.num(data.qty), rate = F.num(data.rate);
    const amount = Math.round(qty * rate * 100) / 100;

    // duplicate invoice check
    const inv = String(data.invoiceNo || "").trim();
    if (inv) {
      const dup = db.expenses.find(e =>
        e.id !== selfId && e.projectId === data.projectId && e.supplierId === data.supplierId &&
        String(e.invoiceNo || "").trim().toUpperCase() === inv.toUpperCase());
      if (dup) return err("DUPLICATE", `Invoice "${inv}" from this supplier is already entered for this project — duplicate expense entries are not allowed.`, "invoiceNo");
    }

    // budget limit check
    const consumed = budgetConsumed(db, data.budgetId);
    const selfExp = selfId ? F.byId(db.expenses, selfId) : null;
    let cQty = consumed.qty, cAmt = consumed.amount;
    if (selfExp) { cQty -= F.num(selfExp.qty); cAmt -= F.num(selfExp.amount); }
    const remainingQty = F.num(bl.qty) - cQty;
    const remainingAmt = F.num(bl.amount) - cAmt;
    const overQty = qty > remainingQty + EPS;
    const overAmt = amount > remainingAmt + EPS;

    if (overQty || overAmt) {
      const allow = String(settings.allowOverBudget) === "YES";
      const isAdmin = user && user.role === "Admin";
      const overrideOk = data.override === "YES" && String(data.overrideReason || "").trim();
      if (!(allow && isAdmin && overrideOk)) {
        return err("OVER_BUDGET",
          `This entry exceeds the remaining budget on this line. Remaining: ${F.qty(remainingQty)} ${F.byId(db.masters.Units, bl.unitId)?.abbrev || ""} / ${F.money(Math.max(0, remainingAmt))}. ` +
          (allow && isAdmin ? "Tick “Override” and give a reason, or reduce the quantity." : "New or additional expenses outside the approved budget are NOT allowed."),
          "qty");
      }
    }
    return null;
  }

  function inUseCheck(db, sheet, id) {
    const uses = (list) => list.some(r =>
      (sheet === "Projects" && r.projectId === id) ||
      (sheet === "Materials" && r.materialId === id) ||
      (sheet === "ExpenseHeads" && r.headId === id) ||
      (sheet === "Shops" && r.shopId === id) ||
      (sheet === "Units" && r.unitId === id) ||
      (sheet === "Suppliers" && r.supplierId === id) ||
      (sheet === "Customers" && r.customerId === id));
    if (uses(db.budget.concat(db.contracts, db.expenses))) {
      return `Cannot delete — this record is referenced by budget, contract or expense entries. Set its status to "Inactive" instead.`;
    }
    if (sheet === "Units" && (db.masters.Materials || []).some(m => m.unit === id)) {
      return "Cannot delete — this unit is used by one or more materials. Reassign those materials first.";
    }
    return null;
  }

  /* ---------------- action handler ---------------- */
  function handle(db, action, payload, meta) {
    const user = meta.user || null;
    const data = payload || {};
    const delay = 180 + Math.random() * 200;

    return new Promise(resolve => {
      setTimeout(() => {
        let out;
        try { out = route(db, action, data, user); } catch (e) {
          out = { ok: false, error: { code: "SERVER", message: "Unexpected error: " + (e && e.message) } };
        }
        resolve(out);
      }, delay);
    });

    function route(d, action, data, user) {
      switch (action) {

        case "ping":
          return { ok: true, data: { version: d.db.version, backendVersion: 3, timestamp: F.nowStamp(), mode: "demo", counts: {
            users: d.db.users.length,
            projects: (d.db.masters.Projects || []).length,
            shops: (d.db.masters.Shops || []).length,
            expenseHeads: (d.db.masters.ExpenseHeads || []).length,
            materials: (d.db.masters.Materials || []).length,
            units: (d.db.masters.Units || []).length,
            suppliers: (d.db.masters.Suppliers || []).length,
            customers: (d.db.masters.Customers || []).length,
            budget: d.db.budget.length,
            contracts: d.db.contracts.length,
            expenses: d.db.expenses.length,
          } } };

        case "getVersion":
          return { ok: true, data: { version: d.db.version, backendVersion: 3, timestamp: F.nowStamp() } };

        case "login": {
          const u = d.db.users.find(x => String(x.name).toLowerCase() === String(data.name || "").toLowerCase());
          if (!u) return err("LOGIN", "User not found. Please check your name.");
          if (u.active !== "YES") return err("LOGIN", "This user account is inactive. Contact an administrator.");
          if (String(u.pin) !== String(data.pin || "")) return err("LOGIN", "Incorrect PIN. (Default PIN is 1234 — change it in Settings.)");
          d.audit(u.name, "LOGIN", "System", u.name, "Signed in");
          d.persist(d.db);
          return { ok: true, data: { user: { name: u.name, role: u.role, id: u.id }, token: "demo-" + F.hash(u.name) } };
        }

        case "getState": {
          const s = d.db.settings;
          return { ok: true, data: { version: d.db.version, timestamp: F.nowStamp(), settings: s, mode: "demo" } };
        }

        case "getLoginUsers": {
          return { ok: true, data: { rows: d.db.users.filter(u => u.active === "YES").map(u => ({ id: u.id, name: u.name, role: u.role })), backendVersion: 3 } };
        }

        case "getSettings":
          return { ok: true, data: { settings: d.db.settings } };

        case "saveSettings": {
          if (!can(user, "settings")) return err("PERM", "You do not have permission to change settings.");
          const allowed = ["companyName", "companyAddress", "companyPhone", "companyEmail", "currency", "defaultVAT", "allowOverBudget", "pollInterval"];
          const next = {};
          allowed.forEach(k => { if (data.settings && data.settings[k] !== undefined) next[k] = data.settings[k]; });
          next.allowOverBudget = next.allowOverBudget === "YES" ? "YES" : "NO";
          d.db.settings = Object.assign({}, d.db.settings, next);
          d.audit(user.name, "UPDATE", "Settings", "", "Settings updated");
          d.bump();
          return { ok: true, data: { settings: d.db.settings, version: d.db.version } };
        }

        case "getUsers": {
          if (!can(user, "users")) return err("PERM", "You do not have permission to view users.");
          return { ok: true, data: { rows: d.db.users } };
        }

        case "saveUser": {
          if (!can(user, "users")) return err("PERM", "Only administrators can manage users.");
          if (!String(data.name || "").trim()) return err("REQUIRED", "Name is required", "name");
          if (!String(data.pin || "").trim()) return err("REQUIRED", "PIN is required", "pin");
          const dup = d.db.users.find(u => u.id !== data.id && String(u.name).toLowerCase() === String(data.name || "").toLowerCase());
          if (dup) return err("DUPLICATE", "A user with this name already exists.", "name");
          if (data.id) {
            const u = F.byId(d.db.users, data.id);
            if (!u) return err("NOT_FOUND", "User not found.");
            Object.assign(u, { name: data.name, role: data.role, pin: data.pin, active: data.active, });
            d.audit(user.name, "UPDATE", "User", u.name, `Updated user (role ${u.role})`);
          } else {
            const nu = { id: d.nextId("U"), name: data.name, role: data.role || "Clerk", pin: data.pin, active: data.active || "YES", createdAt: F.nowStamp() };
            d.db.users.push(nu);
            d.audit(user.name, "CREATE", "User", nu.name, `Created user (role ${nu.role})`);
          }
          d.bump();
          return { ok: true, data: { rows: d.db.users, version: d.db.version } };
        }

        case "deleteUser": {
          if (!can(user, "users")) return err("PERM", "Only administrators can manage users.");
          const u = F.byId(d.db.users, data.id);
          if (!u) return err("NOT_FOUND", "User not found.");
          if (u.name === user.name) return err("INVALID", "You cannot delete your own account.");
          const admins = d.db.users.filter(x => x.role === "Admin" && x.active === "YES").length;
          if (u.role === "Admin" && admins <= 1) return err("INVALID", "At least one active admin must remain.");
          d.db.users = d.db.users.filter(x => x.id !== data.id);
          d.audit(user.name, "DELETE", "User", u.name, "Deleted user");
          d.bump();
          return { ok: true, data: { rows: d.db.users, version: d.db.version } };
        }

        case "changePin": {
          const u = F.byId(d.db.users, data.id) || d.db.users.find(x => x.name === user.name);
          if (!u) return err("NOT_FOUND", "User not found.");
          if (String(u.pin) !== String(data.oldPin || "")) return err("LOGIN", "Current PIN is incorrect.");
          if (!String(data.newPin || "").trim() || String(data.newPin).length < 4) return err("INVALID", "New PIN must be at least 4 characters.");
          u.pin = String(data.newPin);
          d.audit(u.name, "UPDATE", "User", u.name, "Changed PIN");
          d.bump();
          return { ok: true, data: { user: { name: u.name, role: u.role, id: u.id } } };
        }

        case "getMasters": {
          const sheet = data.sheet;
          if (!MASTER_SHEETS.includes(sheet)) return err("INVALID", "Unknown master sheet.");
          return { ok: true, data: { rows: d.db.masters[sheet] || [], version: d.db.version } };
        }

        case "saveMaster": {
          const sheet = data.sheet;
          if (!MASTER_SHEETS.includes(sheet)) return err("INVALID", "Unknown master sheet.");
          if (!can(user, "masters")) return err("PERM", "You do not have permission to manage masters.");
          const row = data.data || {};
          const dupErr = masterDupError(sheet, row, data.id || null, d.db);
          if (dupErr) return dupErr;
          if (sheet === "Materials" && !row.unit) return err("REQUIRED", "Unit is required for materials", "unit");
          if (data.id) {
            const ex = F.byId(d.db.masters[sheet], data.id);
            if (!ex) return err("NOT_FOUND", "Record not found.");
            if (!can(user, "edit")) return err("PERM", "You do not have permission to edit records.");
            Object.assign(ex, row, { updatedBy: user.name, updatedAt: F.nowStamp() });
            d.audit(user.name, "UPDATE", sheet, ex.name, `Updated ${sheet.slice(0, -1)}`);
          } else {
            if (!can(user, "create")) return err("PERM", "You do not have permission to create records.");
            const nu = Object.assign({ id: d.nextId(sheet.slice(0, 2).toUpperCase()), createdBy: user.name, createdAt: F.nowStamp(), updatedBy: "", updatedAt: "" }, row);
            d.db.masters[sheet].push(nu);
            d.audit(user.name, "CREATE", sheet, nu.name, `Created ${sheet.slice(0, -1)}`);
          }
          d.bump();
          return { ok: true, data: { rows: d.db.masters[sheet], version: d.db.version } };
        }

        case "deleteMaster": {
          const sheet = data.sheet;
          if (!MASTER_SHEETS.includes(sheet)) return err("INVALID", "Unknown master sheet.");
          if (!can(user, "delete")) return err("PERM", "You do not have permission to delete records.");
          const ex = F.byId(d.db.masters[sheet], data.id);
          if (!ex) return err("NOT_FOUND", "Record not found.");
          const blocked = inUseCheck(d.db, sheet, data.id);
          if (blocked) return err("IN_USE", blocked);
          d.db.masters[sheet] = d.db.masters[sheet].filter(x => x.id !== data.id);
          d.audit(user.name, "DELETE", sheet, ex.name, `Deleted ${sheet.slice(0, -1)}`);
          d.bump();
          return { ok: true, data: { rows: d.db.masters[sheet], version: d.db.version } };
        }

        case "getBudget":
          return { ok: true, data: { rows: d.db.budget, version: d.db.version } };

        case "saveBudgetLine": {
          if (!can(user, "create")) return err("PERM", "You do not have permission to create records.");
          if (data.id && !can(user, "edit")) return err("PERM", "You do not have permission to edit records.");
          const row = Object.assign({}, data.data || {});
          const vErr = validateBudgetLine(d.db, row, data.id || null);
          if (vErr) return vErr;
          const qty = F.num(row.qty), rate = F.num(row.rate);
          row.amount = Math.round(qty * rate * 100) / 100;
          const mat = F.byId(d.db.masters.Materials, row.materialId);
          if (mat && mat.unit) row.unitId = mat.unit;
          if (data.id) {
            const ex = F.byId(d.db.budget, data.id);
            if (!ex) return err("NOT_FOUND", "Budget line not found.");
            Object.assign(ex, row, { updatedBy: user.name, updatedAt: F.nowStamp() });
            d.audit(user.name, "UPDATE", "Budget", ex.id, "Updated budget line");
          } else {
            const nu = Object.assign({ id: d.nextId("B"), createdBy: user.name, createdAt: F.nowStamp(), updatedBy: "", updatedAt: "" }, row);
            d.db.budget.push(nu);
            d.audit(user.name, "CREATE", "Budget", nu.id, "Created budget line");
          }
          d.bump();
          return { ok: true, data: { rows: d.db.budget, version: d.db.version } };
        }

        case "deleteBudgetLine": {
          if (!can(user, "delete")) return err("PERM", "You do not have permission to delete records.");
          const ex = F.byId(d.db.budget, data.id);
          if (!ex) return err("NOT_FOUND", "Budget line not found.");
          const consumed = budgetConsumed(d.db, data.id);
          if (consumed.qty > 0 || consumed.amount > 0) {
            return err("IN_USE", `This budget line has ${F.money(consumed.amount)} already consumed by ${d.db.expenses.filter(e => e.budgetId === data.id).length} expense entry(ies) and cannot be deleted. Set its status to "Hold" instead.`);
          }
          d.db.budget = d.db.budget.filter(x => x.id !== data.id);
          d.audit(user.name, "DELETE", "Budget", ex.id, "Deleted budget line");
          d.bump();
          return { ok: true, data: { rows: d.db.budget, version: d.db.version } };
        }

        case "getContracts":
          return { ok: true, data: { rows: d.db.contracts, version: d.db.version } };

        case "saveContract": {
          if (!can(user, "create")) return err("PERM", "You do not have permission to create records.");
          if (data.id && !can(user, "edit")) return err("PERM", "You do not have permission to edit records.");
          const row = Object.assign({}, data.data || {});
          const vErr = validateContract(d.db, row, data.id || null);
          if (vErr) return vErr;
          const amount = F.num(row.amount);
          const vatRate = F.num(row.vatRate);
          row.direction = row.type === "LPO" ? "Expense" : "Income";
          row.vatAmount = Math.round(amount * vatRate) / 100;
          row.total = Math.round((amount + row.vatAmount) * 100) / 100;
          if (data.id) {
            const ex = F.byId(d.db.contracts, data.id);
            if (!ex) return err("NOT_FOUND", "Record not found.");
            Object.assign(ex, row, { updatedBy: user.name, updatedAt: F.nowStamp() });
            d.audit(user.name, "UPDATE", "Contract", ex.refNo, `Updated ${ex.type}`);
          } else {
            const nu = Object.assign({ id: d.nextId("CT"), createdBy: user.name, createdAt: F.nowStamp(), updatedBy: "", updatedAt: "" }, row);
            d.db.contracts.push(nu);
            d.audit(user.name, "CREATE", "Contract", nu.refNo, `Created ${nu.type}`);
          }
          d.bump();
          return { ok: true, data: { rows: d.db.contracts, version: d.db.version } };
        }

        case "deleteContract": {
          if (!can(user, "delete")) return err("PERM", "You do not have permission to delete records.");
          const ex = F.byId(d.db.contracts, data.id);
          if (!ex) return err("NOT_FOUND", "Record not found.");
          d.db.contracts = d.db.contracts.filter(x => x.id !== data.id);
          d.audit(user.name, "DELETE", "Contract", ex.refNo, `Deleted ${ex.type}`);
          d.bump();
          return { ok: true, data: { rows: d.db.contracts, version: d.db.version } };
        }

        case "getExpenses":
          return { ok: true, data: { rows: d.db.expenses, version: d.db.version } };

        case "saveExpense": {
          if (!can(user, "create")) return err("PERM", "You do not have permission to create records.");
          if (data.id && !can(user, "edit")) return err("PERM", "You do not have permission to edit records.");
          const row = Object.assign({}, data.data || {});
          const vErr = validateExpense(d.db, row, data.id || null, d.db.settings, user);
          if (vErr) return vErr;
          const bl = F.byId(d.db.budget, row.budgetId);
          const qty = F.num(row.qty), rate = F.num(row.rate);
          row.headId = bl.headId;
          row.materialId = bl.materialId;
          row.unitId = bl.unitId;
          row.shopId = bl.shopId;
          row.amount = Math.round(qty * rate * 100) / 100;
          const consumed = budgetConsumed(d.db, row.budgetId);
          const selfExp = data.id ? F.byId(d.db.expenses, data.id) : null;
          let cQty = consumed.qty, cAmt = consumed.amount;
          if (selfExp) { cQty -= F.num(selfExp.qty); cAmt -= F.num(selfExp.amount); }
          row.override = row.override === "YES" ? "YES" : "NO";
          if (row.override === "YES" && (cQty + qty <= F.num(bl.qty) + EPS) && (cAmt + row.amount <= F.num(bl.amount) + EPS)) {
            row.override = "NO"; row.overrideReason = "";
          }
          if (data.id) {
            const ex = F.byId(d.db.expenses, data.id);
            if (!ex) return err("NOT_FOUND", "Expense not found.");
            Object.assign(ex, row, { updatedBy: user.name, updatedAt: F.nowStamp() });
            d.audit(user.name, "UPDATE", "Expense", ex.invoiceNo || ex.id, "Updated expense entry");
          } else {
            const nu = Object.assign({ id: d.nextId("E"), createdBy: user.name, createdAt: F.nowStamp(), updatedBy: "", updatedAt: "" }, row);
            d.db.expenses.push(nu);
            d.audit(user.name, "CREATE", "Expense", nu.invoiceNo || nu.id, `Expense ${F.money(nu.amount)} against budget line ${bl.id}${nu.override === "YES" ? " (over-budget override: " + nu.overrideReason + ")" : ""}`);
          }
          d.bump();
          return { ok: true, data: { rows: d.db.expenses, version: d.db.version } };
        }

        case "deleteExpense": {
          if (!can(user, "delete")) return err("PERM", "You do not have permission to delete records.");
          const ex = F.byId(d.db.expenses, data.id);
          if (!ex) return err("NOT_FOUND", "Expense not found.");
          d.db.expenses = d.db.expenses.filter(x => x.id !== data.id);
          d.audit(user.name, "DELETE", "Expense", ex.invoiceNo || ex.id, "Deleted expense entry — budget consumption reversed");
          d.bump();
          return { ok: true, data: { rows: d.db.expenses, version: d.db.version } };
        }

        case "getAudit": {
          const rows = d.db.audit.slice(0, Number(data.limit) || 300);
          if (data.q) {
            return { ok: true, data: { rows: rows.filter(r => F.matchSearch(data.q, `${r.user} ${r.action} ${r.entity} ${r.ref} ${r.details}`)) } };
          }
          return { ok: true, data: { rows } };
        }

        case "getAll": {
          return {
            ok: true,
            data: {
              version: d.db.version, timestamp: F.nowStamp(), mode: "demo",
              settings: d.db.settings,
              users: d.db.users.map(u => ({ id: u.id, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt })),
              masters: d.db.masters,
              budget: d.db.budget, contracts: d.db.contracts, expenses: d.db.expenses,
              audit: d.db.audit.slice(0, 300),
            },
          };
        }

        case "resetDemo": {
          const fresh = seed();
          d.db = fresh;
          d.persist(d.db);
          return { ok: true, data: { version: d.db.version, message: "Demo data reset to factory sample." } };
        }

        case "selftest": {
          const results = [];
          const check = (name, fn) => {
            try { fn(); results.push({ name, pass: true }); }
            catch (e) { results.push({ name, pass: false, error: String(e && e.message || e) }); }
          };
          check("strict: expense without budget line blocked", () => {
            const r = validateExpense(d.db, { projectId: "P1", qty: 1, rate: 100, date: "2026-08-20", supplierId: "S1" }, null, d.db.settings, { role: "Admin" });
            if (!r || r.ok !== false) throw new Error("expected error");
          });
          check("strict: expense over remaining budget blocked", () => {
            const r = validateExpense(d.db, { projectId: "P1", budgetId: "B02", qty: 9999, rate: 28000, date: "2026-08-20", supplierId: "S1" }, null, d.db.settings, { role: "Admin" });
            if (!r || r.ok !== false || r.error.code !== "OVER_BUDGET") throw new Error("expected OVER_BUDGET");
          });
          check("duplicate: contract ref rejected", () => {
            const r = validateContract(d.db, { type: "Sales Invoice", refNo: "INV-2026-001", date: "2026-08-20", projectId: "P1", customerId: "C1", amount: 1000, vatRate: 16.5, status: "Issued" }, null);
            if (!r || r.ok !== false || r.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
          });
          check("duplicate: budget line combo rejected", () => {
            const r = validateBudgetLine(d.db, { projectId: "P1", headId: "H1", materialId: "M1", shopId: "SH1", qty: 10, rate: 100, status: "Approved" }, null);
            if (!r || r.ok !== false || r.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
          });
          check("consistency: every expense has a valid budget line", () => {
            d.db.expenses.forEach(e => {
              const bl = F.byId(d.db.budget, e.budgetId);
              if (!bl) throw new Error("orphan expense " + e.id);
            });
          });
          return { ok: true, data: { results } };
        }

        default:
          return err("UNKNOWN", "Unknown action: " + action);
      }
    }
  }

  root.Mock = {
    KEY, PERMS, can, seed, MockDB, handle,
    validateMaster: masterDupError, validateBudgetLine, validateContract, validateExpense, inUseCheck,
  };
})(typeof window !== "undefined" ? window : globalThis);
