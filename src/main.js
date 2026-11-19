import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import Basemap from "@arcgis/core/Basemap.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import LayerList from "@arcgis/core/widgets/LayerList.js";
import Legend from "@arcgis/core/widgets/Legend.js";
import Home from "@arcgis/core/widgets/Home.js";
import ScaleBar from "@arcgis/core/widgets/ScaleBar.js";
import FeatureTable from "@arcgis/core/widgets/FeatureTable.js";
import Editor from "@arcgis/core/widgets/Editor.js";
import IdentityManager from "@arcgis/core/identity/IdentityManager.js";
import CustomContent from "@arcgis/core/popup/content/CustomContent.js";

const PORTAL_TOKEN_URL = "https://hcmgis.esrivn.net/portal/sharing/rest/generateToken";
const SERVICE_URL =
  "https://hcmgis.esrivn.net/server/rest/services/Hosted/CayXanh_GoVap_HaiAnh/FeatureServer";

// 1. Khởi tạo Basemap OpenStreetMap qua WebTileLayer
const osmBasemap = new Basemap({
  baseLayers: [
    new WebTileLayer({
      urlTemplate: "https://{subDomain}.tile.openstreetmap.org/{level}/{col}/{row}.png",
      subDomains: ["a", "b", "c"],
      copyright: "© OpenStreetMap contributors"
    })
  ],
  title: "Bản đồ đường phố (OSM)",
  id: "osm-custom"
});

// 2. Khởi tạo 4 lớp không gian + Bảng quan hệ Lịch sử chăm sóc (mặc định ID 4, tự cập nhật khi tải metadata)
const ranhGioiPhuongLayer = new FeatureLayer({
  url: `${SERVICE_URL}/3`,
  title: "Ranh giới hành chính phường",
  opacity: 0.5
});

const congVienLayer = new FeatureLayer({
  url: `${SERVICE_URL}/2`,
  title: "Công viên - Mảng xanh",
  opacity: 0.75
});

const tuyenDuongLayer = new FeatureLayer({
  url: `${SERVICE_URL}/1`,
  title: "Tuyến đường giao thông"
});

const cayXanhLayer = new FeatureLayer({
  url: `${SERVICE_URL}/0`,
  title: "Cây xanh đô thị",
  outFields: ["*"]
});

let lichSuChamSocTable = new FeatureLayer({
  url: `${SERVICE_URL}/4`,
  title: "Lịch sử chăm sóc cây xanh",
  outFields: ["*"]
});

// 3. Khởi tạo Map & MapView
const map = new Map({
  basemap: osmBasemap,
  layers: [ranhGioiPhuongLayer, congVienLayer, tuyenDuongLayer, cayXanhLayer]
});

const view = new MapView({
  container: "viewDiv",
  map: map,
  center: [106.665, 10.838],
  zoom: 13
});

// 4. Các Widget điều khiển bản đồ cơ bản
view.ui.add(new Home({ view }), "top-left");
view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-left");
new LayerList({ view, container: "layerListDiv" });
new Legend({ view, container: "legendDiv" });

// 5. Khởi tạo Bảng thuộc tính (FeatureTable) và đồng bộ khi chọn dòng
let featureTable = null;
try {
  featureTable = new FeatureTable({
    view: view,
    layer: cayXanhLayer,
    container: "tableDiv",
    visibleElements: {
      header: true,
      menu: true,
      selectionColumn: true
    }
  });

  featureTable.highlightIds.on("change", async (event) => {
    if (event.added && event.added.length > 0) {
      const selectedOID = event.added[0];
      const q = cayXanhLayer.createQuery();
      q.objectIds = [selectedOID];
      q.returnGeometry = true;
      const res = await cayXanhLayer.queryFeatures(q);
      if (res.features.length > 0) {
        const feat = res.features[0];
        selectTreeForCareLog(feat);
        await view.goTo({ target: feat.geometry, zoom: 18 });
        view.openPopup({ features: [feat], location: feat.geometry });
      }
    }
  });
} catch (err) {
  console.error("Lỗi khởi tạo FeatureTable:", err);
}

// 6. Biến lưu tên cột thực tế trên Server
const FIELD_MAP = {
  maCay: "MaCay",
  loaiCay: "LoaiCay",
  tuyenDuong: "TuyenDuong",
  phuong: "Phuong",
  tinhTrang: "TinhTrang",
  globalId: "GlobalID"
};

const CARE_FIELD_MAP = {
  foreignKey: "MaCay",
  ngayChamSoc: "NgayChamSoc",
  noiDung: "NoiDung",
  donVi: "DonViThucHien",
  ghiChu: "GhiChu"
};

function detectFieldName(fields, candidates, fallback) {
  const lowerMap = {};
  fields.forEach((f) => {
    lowerMap[f.name.toLowerCase()] = f.name;
  });
  for (const c of candidates) {
    if (lowerMap[c.toLowerCase()]) return lowerMap[c.toLowerCase()];
  }
  return fallback;
}

// 7. Khi bản đồ và lớp cây xanh tải xong
view.when(async () => {
  try {
    await cayXanhLayer.load();

    const fields = cayXanhLayer.fields || [];
    FIELD_MAP.maCay = detectFieldName(fields, ["macay", "ma_cay"], "MaCay");
    FIELD_MAP.loaiCay = detectFieldName(fields, ["loaicay", "tencay", "loai_cay", "ten_cay"], "LoaiCay");
    FIELD_MAP.tuyenDuong = detectFieldName(fields, ["tuyenduong", "tenduong", "tuyen_duong", "ten_duong"], "TuyenDuong");
    FIELD_MAP.phuong = detectFieldName(fields, ["phuong", "tenphuong", "maphuong", "ten_phuong"], "Phuong");
    FIELD_MAP.tinhTrang = detectFieldName(fields, ["tinhtrang", "tinh_trang"], "TinhTrang");
    FIELD_MAP.globalId = detectFieldName(fields, ["globalid"], "GlobalID");

    const fieldInfos = fields
      .filter((f) => !["shape", "globalid"].includes(f.name.toLowerCase()))
      .map((f) => ({
        fieldName: f.name,
        label: f.alias || f.name
      }));

    const popupElements = [
      { type: "fields", fieldInfos },
      { type: "attachments" }
    ];

    // Tự động lấy đúng ID bảng quan hệ thật, thêm vào map.tables và truy vấn trực tiếp qua CustomContent
    if (cayXanhLayer.relationships && cayXanhLayer.relationships.length > 0) {
      const rel = cayXanhLayer.relationships[0];
      console.log("Thông tin Relationship trên Server:", rel);

      lichSuChamSocTable = new FeatureLayer({
        url: `${SERVICE_URL}/${rel.relatedTableId}`,
        title: rel.name || "Lịch sử chăm sóc cây xanh",
        outFields: ["*"]
      });
      map.tables.add(lichSuChamSocTable);

      const careLogContent = new CustomContent({
        outFields: ["*"],
        creator: async (event) => {
          const container = document.createElement("div");
          container.style.marginTop = "8px";

          const oidField = cayXanhLayer.objectIdField || "OBJECTID";
          const oid = event.graphic.attributes[oidField];

          try {
            const relatedRes = await cayXanhLayer.queryRelatedFeatures({
              outFields: ["*"],
              relationshipId: rel.id,
              objectIds: [oid]
            });

            const featureSet = relatedRes[oid];
            const records = featureSet ? featureSet.features : [];

            if (records.length === 0) {
              container.innerHTML = `
                <div style="padding:8px 10px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;font-size:12.5px;color:#64748b;">
                  <strong>📋 Lịch sử chăm sóc &amp; Duy tu:</strong><br/>
                  Chưa có bản ghi chăm sóc nào cho cây này.
                </div>`;
              return container;
            }

            // Ánh xạ tên hiển thị (alias) của các cột bảng Lịch sử chăm sóc
            const aliasMap = {};
            (lichSuChamSocTable.fields || []).forEach((f) => {
              aliasMap[f.name] = f.alias || f.name;
            });

            const itemsHtml = records
              .map((rec, idx) => {
                const attrs = rec.attributes;
                const rows = Object.entries(attrs)
                  .filter(
                    ([k, v]) =>
                      v !== null &&
                      v !== "" &&
                      !["objectid", "globalid", "parentglobalid"].includes(k.toLowerCase())
                  )
                  .map(([k, v]) => {
                    const isDate = k.toLowerCase().includes("ngay") && typeof v === "number";
                    const displayVal = isDate ? new Date(v).toLocaleDateString("vi-VN") : v;
                    const label = aliasMap[k] || k;
                    return `<div><strong>${label}:</strong> ${displayVal}</div>`;
                  })
                  .join("");
                return `
                  <div style="padding:7px 9px;margin-top:6px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:12px;">
                    <div style="font-weight:700;color:#15803d;margin-bottom:2px;">Đợt chăm sóc #${idx + 1}</div>
                    ${rows}
                  </div>`;
              })
              .join("");

            container.innerHTML = `
              <div style="font-weight:700;color:#1b5e20;font-size:13px;margin-bottom:4px;">
                📋 Lịch sử chăm sóc &amp; Duy tu (${records.length} đợt)
              </div>
              ${itemsHtml}`;
          } catch (err) {
            container.innerHTML = `<div style="color:#dc2626;font-size:12px;">Không thể tải lịch sử chăm sóc: ${err.message}</div>`;
          }
          return container;
        }
      });

      popupElements.push(careLogContent);
    } else {
      map.tables.add(lichSuChamSocTable);
    }

    cayXanhLayer.popupTemplate = {
      title: `🌳 Cây xanh: {${FIELD_MAP.maCay}} - {${FIELD_MAP.loaiCay}}`,
      content: popupElements
    };

    // Tự động nhận diện tên trường của bảng LichSuChamSoc theo đúng bảng đã nạp
    try {
      await lichSuChamSocTable.load();
      const cFields = lichSuChamSocTable.fields || [];
      CARE_FIELD_MAP.foreignKey = detectFieldName(
        cFields,
        ["macay", "ma_cay", "parentglobalid", "cayxanh_id", "guid"],
        FIELD_MAP.maCay
      );
      CARE_FIELD_MAP.ngayChamSoc = detectFieldName(
        cFields,
        ["ngaychamsoc", "ngay_cham_soc", "ngaythuchien", "ngay"],
        "NgayChamSoc"
      );
      CARE_FIELD_MAP.noiDung = detectFieldName(
        cFields,
        ["noidung", "noi_dung", "congviec", "loaicongviec", "hangmuc"],
        "NoiDung"
      );
      CARE_FIELD_MAP.donVi = detectFieldName(
        cFields,
        ["donvithuchien", "donvi", "nguoi_thuc_hien", "nguoithuchien", "nhanvien"],
        "DonViThucHien"
      );
      CARE_FIELD_MAP.ghiChu = detectFieldName(
        cFields,
        ["ghichu", "ghi_chu", "ketqua", "mota"],
        "GhiChu"
      );
      console.log("Đã nhận diện các trường bảng LichSuChamSoc:", CARE_FIELD_MAP);
    } catch (e) {
      console.warn("Bảng LichSuChamSoc chưa sẵn sàng hoặc khác ID:", e);
    }

    const extentRes = await cayXanhLayer.queryExtent();
    if (extentRes && extentRes.extent) {
      view.goTo(extentRes.extent.expand(1.15));
    }

    await populateFilterDropdowns();
    await updateTreeCount();

    // Cập nhật tự động bộ đếm và bảng thuộc tính sau khi Thêm/Sửa/Xóa qua Editor
    cayXanhLayer.on("edits", () => {
      updateTreeCount();
      if (featureTable) featureTable.refresh();
    });
  } catch (err) {
    console.error("Lỗi khi tải lớp Cây xanh:", err);
  }
});

// 8. Bắt sự kiện click trên bản đồ để lấy cây xanh đang chọn cho form Nhật ký chăm sóc
let selectedTreeFeature = null;

function selectTreeForCareLog(feature) {
  selectedTreeFeature = feature;
  const banner = document.getElementById("selectedTreeInfo");
  const btnAdd = document.getElementById("btnAddCareLog");
  if (!feature) {
    banner.textContent = "👉 Nhấp chọn 1 cây xanh trên bản đồ để ghi nhật ký";
    btnAdd.disabled = true;
    return;
  }
  const maCayVal =
    feature.attributes[FIELD_MAP.maCay] ||
    `OID #${feature.attributes.OBJECTID || feature.attributes.objectid}`;
  const loaiCayVal = feature.attributes[FIELD_MAP.loaiCay] || "";
  banner.textContent = `✅ Đang chọn cây: ${maCayVal} (${loaiCayVal})`;
  btnAdd.disabled = false;
}

view.on("click", async (event) => {
  const hit = await view.hitTest(event);
  const treeHit = hit.results.find((r) => r.graphic && r.graphic.layer === cayXanhLayer);
  if (treeHit) {
    selectTreeForCareLog(treeHit.graphic);
  }
});

// Đặt ngày mặc định cho ô Ngày chăm sóc là hôm nay
const todayStr = new Date().toISOString().split("T")[0];
const careDateInput = document.getElementById("careDate");
if (careDateInput) careDateInput.value = todayStr;

// 9. PHÂN HỆ XÁC THỰC NGƯỜI DÙNG (AUTHENTICATION) & KHỞI TẠO EDITOR WIDGET (TUẦN 7)
let isLoggedIn = false;
let currentUser = "";
let editorWidget = null;

const loginModal = document.getElementById("loginModal");
const btnAuthAction = document.getElementById("btnAuthAction");
const roleBadge = document.getElementById("roleBadge");
const adminPanel = document.getElementById("adminPanel");
const loginErrorMsg = document.getElementById("loginErrorMsg");

btnAuthAction?.addEventListener("click", () => {
  if (!isLoggedIn) {
    loginErrorMsg.textContent = "";
    loginModal.classList.remove("hidden");
  } else {
    isLoggedIn = false;
    currentUser = "";
    IdentityManager.destroyCredentials();

    if (editorWidget) {
      editorWidget.destroy();
      editorWidget = null;
      const newEditorDiv = document.createElement("div");
      newEditorDiv.id = "editorDiv";
      adminPanel.insertBefore(newEditorDiv, adminPanel.querySelector(".care-log-box"));
    }

    adminPanel.classList.add("hidden");
    roleBadge.textContent = "👥 Chế độ: Người dân (Chỉ xem)";
    roleBadge.className = "role-badge public-mode";
    btnAuthAction.textContent = "🔐 Đăng nhập Cán bộ";
    btnAuthAction.classList.remove("logged-in");
  }
});

document.getElementById("btnCloseModal")?.addEventListener("click", () => {
  loginModal.classList.add("hidden");
});
document.getElementById("btnCancelLogin")?.addEventListener("click", () => {
  loginModal.classList.add("hidden");
});

document.getElementById("btnSubmitLogin")?.addEventListener("click", async () => {
  const username = document.getElementById("portalUsername").value.trim();
  const password = document.getElementById("portalPassword").value.trim();

  if (!username || !password) {
    loginErrorMsg.textContent = "⚠️ Vui lòng nhập đầy đủ Username và Password!";
    return;
  }

  const btnSubmit = document.getElementById("btnSubmitLogin");
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Đang xác thực...";
  loginErrorMsg.textContent = "";

  try {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);
    formData.append("client", "referer");
    formData.append("referer", window.location.origin);
    formData.append("expiration", "120");
    formData.append("f", "json");

    const response = await fetch(PORTAL_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });

    const data = await response.json();

    if (data.error || !data.token) {
      throw new Error(data.error?.message || "Sai thông tin tài khoản hoặc mật khẩu Portal!");
    }

    IdentityManager.registerToken({
      server: "https://hcmgis.esrivn.net/portal/sharing/rest",
      token: data.token,
      expires: data.expires,
      ssl: data.ssl
    });
    IdentityManager.registerToken({
      server: "https://hcmgis.esrivn.net/server/rest/services",
      token: data.token,
      expires: data.expires,
      ssl: data.ssl
    });

    isLoggedIn = true;
    currentUser = username;
    loginModal.classList.add("hidden");

    roleBadge.textContent = `🛡️ Cán bộ: ${currentUser} (Toàn quyền)`;
    roleBadge.className = "role-badge admin-mode";
    btnAuthAction.textContent = "🚪 Đăng xuất";
    btnAuthAction.classList.add("logged-in");

    adminPanel.classList.remove("hidden");

    if (!editorWidget) {
      editorWidget = new Editor({
        view: view,
        container: "editorDiv",
        layerInfos: [
          {
            layer: cayXanhLayer,
            enabled: true,
            addEnabled: true,
            updateEnabled: true,
            deleteEnabled: true,
            attachmentsOnCreateEnabled: true,
            attachmentsOnUpdateEnabled: true
          },
          { layer: tuyenDuongLayer, enabled: false },
          { layer: congVienLayer, enabled: false },
          { layer: ranhGioiPhuongLayer, enabled: false }
        ]
      });
    }
  } catch (err) {
    loginErrorMsg.textContent = `❌ Lỗi: ${err.message}`;
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Đăng nhập & Cấp Token";
  }
});

// 10. LƯU BẢN GHI MỚI VÀO BẢNG QUAN HỆ LICHSUCHAMSOC QUA APPLYEDITS (TUẦN 7)
document.getElementById("btnAddCareLog")?.addEventListener("click", async () => {
  const statusEl = document.getElementById("careStatusMsg");
  if (!selectedTreeFeature) {
    statusEl.style.color = "#dc2626";
    statusEl.textContent = "⚠️ Vui lòng chọn 1 cây xanh trên bản đồ trước!";
    return;
  }

  const careDate = document.getElementById("careDate").value;
  const careWork = document.getElementById("careWork").value;
  const careUnit = document.getElementById("careUnit").value.trim();
  const careNote = document.getElementById("careNote").value.trim();

  const fkFieldLower = CARE_FIELD_MAP.foreignKey.toLowerCase();
  let fkValue = selectedTreeFeature.attributes[FIELD_MAP.maCay];
  if (fkFieldLower.includes("globalid") || fkFieldLower.includes("guid")) {
    fkValue =
      selectedTreeFeature.attributes[FIELD_MAP.globalId] ||
      selectedTreeFeature.attributes.GlobalID ||
      selectedTreeFeature.attributes.globalid;
  }

  const attributes = {
    [CARE_FIELD_MAP.foreignKey]: fkValue,
    [CARE_FIELD_MAP.ngayChamSoc]: careDate ? new Date(careDate).getTime() : Date.now(),
    [CARE_FIELD_MAP.noiDung]: careWork,
    [CARE_FIELD_MAP.donVi]: careUnit || currentUser || "Đội Duy tu Gò Vấp",
    [CARE_FIELD_MAP.ghiChu]: careNote
  };

  const btnAdd = document.getElementById("btnAddCareLog");
  btnAdd.disabled = true;
  statusEl.style.color = "#1b5e20";
  statusEl.textContent = "⏳ Đang lưu lên ArcGIS Server...";

  try {
    const editResult = await lichSuChamSocTable.applyEdits({
      addFeatures: [{ attributes }]
    });

    if (
      editResult.addFeatureResults &&
      editResult.addFeatureResults.length > 0 &&
      !editResult.addFeatureResults[0].error
    ) {
      const newOid = editResult.addFeatureResults[0].objectId;
      statusEl.style.color = "#15803d";
      statusEl.textContent = `✅ Đã thêm nhật ký thành công (OBJECTID: ${newOid})!`;
      document.getElementById("careNote").value = "";

      // Tự động làm mới Popup nếu đang mở trên cây vừa thêm nhật ký
      if (view.popup.visible && selectedTreeFeature.geometry) {
        view.openPopup({
          features: [selectedTreeFeature],
          location: selectedTreeFeature.geometry
        });
      }
    } else {
      const errObj = editResult.addFeatureResults?.[0]?.error;
      throw new Error(errObj?.description || errObj?.message || "Không thể ghi vào bảng LichSuChamSoc");
    }
  } catch (err) {
    statusEl.style.color = "#dc2626";
    statusEl.textContent = `❌ Lỗi: ${err.message}`;
  } finally {
    btnAdd.disabled = false;
  }
});

// 11. CÁC HÀM LỌC & TÌM KIẾM ĐA TIÊU CHÍ (KẾ THỪA TỪ TUẦN 6)
async function populateOptionList(selectId, fieldName) {
  const selectEl = document.getElementById(selectId);
  if (!selectEl) return;
  try {
    const q = cayXanhLayer.createQuery();
    q.where = "1=1";
    q.outFields = [fieldName];
    q.returnDistinctValues = true;
    q.returnGeometry = false;
    q.orderByFields = [`${fieldName} ASC`];

    const result = await cayXanhLayer.queryFeatures(q);
    result.features.forEach((feat) => {
      const val = feat.attributes[fieldName];
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        const opt = document.createElement("option");
        opt.value = String(val);
        opt.textContent = String(val);
        selectEl.appendChild(opt);
      }
    });
  } catch (err) {
    console.warn(`Không thể tải danh sách lọc cho trường ${fieldName}:`, err);
  }
}

async function populateFilterDropdowns() {
  await Promise.all([
    populateOptionList("filterPhuong", FIELD_MAP.phuong),
    populateOptionList("filterTuyenDuong", FIELD_MAP.tuyenDuong),
    populateOptionList("filterLoaiCay", FIELD_MAP.loaiCay),
    populateOptionList("filterTinhTrang", FIELD_MAP.tinhTrang)
  ]);
}

async function updateTreeCount() {
  const countEl = document.getElementById("treeCountVal");
  if (!countEl) return;
  try {
    const q = cayXanhLayer.createQuery();
    q.where = cayXanhLayer.definitionExpression || "1=1";
    const count = await cayXanhLayer.queryFeatureCount(q);
    countEl.textContent = `${count} cây`;
  } catch {
    countEl.textContent = "N/A";
  }
}

async function applyCombinedFilter(zoomToResult = false) {
  const keyword = document.getElementById("searchInput").value.trim().replace(/'/g, "''");
  const phuong = document.getElementById("filterPhuong").value.replace(/'/g, "''");
  const tuyenDuong = document.getElementById("filterTuyenDuong").value.replace(/'/g, "''");
  const loaiCay = document.getElementById("filterLoaiCay").value.replace(/'/g, "''");
  const tinhTrang = document.getElementById("filterTinhTrang").value.replace(/'/g, "''");

  const clauses = [];
  if (keyword) {
    clauses.push(
      `(${FIELD_MAP.maCay} LIKE '%${keyword}%' OR ${FIELD_MAP.tuyenDuong} LIKE '%${keyword}%' OR ${FIELD_MAP.loaiCay} LIKE '%${keyword}%')`
    );
  }
  if (phuong) clauses.push(`${FIELD_MAP.phuong} = '${phuong}'`);
  if (tuyenDuong) clauses.push(`${FIELD_MAP.tuyenDuong} = '${tuyenDuong}'`);
  if (loaiCay) clauses.push(`${FIELD_MAP.loaiCay} = '${loaiCay}'`);
  if (tinhTrang) clauses.push(`${FIELD_MAP.tinhTrang} = '${tinhTrang}'`);

  const whereClause = clauses.length > 0 ? clauses.join(" AND ") : "1=1";
  cayXanhLayer.definitionExpression = whereClause;

  await updateTreeCount();

  const q = cayXanhLayer.createQuery();
  q.where = whereClause;
  q.returnGeometry = true;
  const res = await cayXanhLayer.queryFeatures(q);

  if (res.features.length === 1) {
    const feat = res.features[0];
    selectTreeForCareLog(feat);
    await view.goTo({ target: feat.geometry, zoom: 18 });
    view.openPopup({ features: [feat], location: feat.geometry });
  } else if (res.features.length > 1 && (zoomToResult || clauses.length > 0)) {
    const extRes = await cayXanhLayer.queryExtent({ where: whereClause });
    if (extRes && extRes.extent) {
      view.goTo(extRes.extent.expand(1.2));
    }
  }
}

document.getElementById("btnSearch")?.addEventListener("click", () => applyCombinedFilter(true));
document.getElementById("searchInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyCombinedFilter(true);
});
document.getElementById("btnApplyFilter")?.addEventListener("click", () => applyCombinedFilter(true));

document.getElementById("btnResetFilter")?.addEventListener("click", async () => {
  document.getElementById("searchInput").value = "";
  document.getElementById("filterPhuong").value = "";
  document.getElementById("filterTuyenDuong").value = "";
  document.getElementById("filterLoaiCay").value = "";
  document.getElementById("filterTinhTrang").value = "";

  cayXanhLayer.definitionExpression = null;
  view.closePopup();
  await updateTreeCount();

  const extRes = await cayXanhLayer.queryExtent();
  if (extRes && extRes.extent) {
    view.goTo(extRes.extent.expand(1.15));
  }
});

document.getElementById("btnToggleTable")?.addEventListener("click", () => {
  document.getElementById("tablePanel")?.classList.toggle("hidden");
});