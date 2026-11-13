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

// URL gốc của Feature Service đã xuất bản ở Tuần 4
const SERVICE_URL =
  "https://hcmgis.esrivn.net/server/rest/services/Hosted/CayXanh_GoVap_HaiAnh/FeatureServer";

// 1. Khởi tạo Basemap OpenStreetMap trực tiếp qua WebTileLayer
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

// 2. Khởi tạo 4 lớp FeatureLayer
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

// 3. Khởi tạo Bản đồ & MapView
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

// 5. Khởi tạo Bảng thuộc tính (FeatureTable) và đồng bộ khi click chọn dòng
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

  // Lắng nghe sự kiện chọn dòng trong bảng để phóng bản đồ tới đúng cây xanh đó
  featureTable.highlightIds.on("change", async (event) => {
    if (event.added && event.added.length > 0) {
      const selectedOID = event.added[0];
      const q = cayXanhLayer.createQuery();
      q.objectIds = [selectedOID];
      q.returnGeometry = true;
      const res = await cayXanhLayer.queryFeatures(q);
      if (res.features.length > 0) {
        const feat = res.features[0];
        await view.goTo({ target: feat.geometry, zoom: 18 });
        view.openPopup({ features: [feat], location: feat.geometry });
      }
    }
  });
} catch (err) {
  console.error("Lỗi khởi tạo FeatureTable:", err);
}

// 6. Biến lưu tên cột thực tế trên FeatureServer
const FIELD_MAP = {
  maCay: "MaCay",
  loaiCay: "LoaiCay",
  tuyenDuong: "TuyenDuong",
  phuong: "Phuong",
  tinhTrang: "TinhTrang"
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

// 7. Khi bản đồ và lớp cây xanh tải xong: Cấu hình Popup + Attachments + Bảng quan hệ LichSuChamSoc
view.when(async () => {
  try {
    await cayXanhLayer.load();

    const fields = cayXanhLayer.fields || [];
    FIELD_MAP.maCay = detectFieldName(fields, ["macay", "ma_cay"], "MaCay");
    FIELD_MAP.loaiCay = detectFieldName(fields, ["loaicay", "tencay", "loai_cay", "ten_cay"], "LoaiCay");
    FIELD_MAP.tuyenDuong = detectFieldName(fields, ["tuyenduong", "tenduong", "tuyen_duong", "ten_duong"], "TuyenDuong");
    FIELD_MAP.phuong = detectFieldName(fields, ["phuong", "tenphuong", "maphuong", "ten_phuong"], "Phuong");
    FIELD_MAP.tinhTrang = detectFieldName(fields, ["tinhtrang", "tinh_trang"], "TinhTrang");

    const fieldInfos = fields
      .filter((f) => !["shape", "globalid"].includes(f.name.toLowerCase()))
      .map((f) => ({
        fieldName: f.name,
        label: f.alias || f.name
      }));

    // Xây dựng danh sách thành phần hiển thị trong Popup
    const popupElements = [
      { type: "fields", fieldInfos },
      { type: "attachments" }
    ];

    // Tự động kiểm tra nếu lớp Cây xanh có Relationship (Bảng LichSuChamSoc) thì đưa vào Popup
    if (cayXanhLayer.relationships && cayXanhLayer.relationships.length > 0) {
      const rel = cayXanhLayer.relationships[0];
      popupElements.push({
        type: "relationship",
        relationshipId: rel.id,
        title: "📋 Lịch sử chăm sóc & Duy tu cây xanh",
        description: "Danh sách các đợt kiểm tra, cắt tỉa, chăm sóc của cây này:",
        displayCount: 5
      });
    }

    cayXanhLayer.popupTemplate = {
      title: `🌳 Cây xanh: {${FIELD_MAP.maCay}} - {${FIELD_MAP.loaiCay}}`,
      content: popupElements
    };

    const extentRes = await cayXanhLayer.queryExtent();
    if (extentRes && extentRes.extent) {
      view.goTo(extentRes.extent.expand(1.15));
    }

    await populateFilterDropdowns();
    await updateTreeCount();
  } catch (err) {
    console.error("Lỗi khi tải lớp Cây xanh:", err);
    document.getElementById("treeCountVal").textContent = "Lỗi kết nối Server";
  }
});

// 8. Hàm tự động truy vấn các giá trị duy nhất (Distinct) từ Server để đổ vào 4 ô lọc
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
    const seen = new Set();
    result.features.forEach((feat) => {
      const val = feat.attributes[fieldName];
      if (val !== null && val !== undefined && String(val).trim() !== "" && !seen.has(val)) {
        seen.add(val);
        const opt = document.createElement("option");
        opt.value = String(val);
        opt.textContent = String(val);
        selectEl.appendChild(opt);
      }
    });
  } catch (err) {
    // Fallback nếu Server không bật returnDistinctValues: lấy 1000 bản ghi đầu để gom nhóm
    try {
      const qFallback = cayXanhLayer.createQuery();
      qFallback.where = "1=1";
      qFallback.outFields = [fieldName];
      qFallback.returnGeometry = false;
      const resFallback = await cayXanhLayer.queryFeatures(qFallback);
      const uniqueVals = [...new Set(resFallback.features.map((f) => f.attributes[fieldName]).filter(Boolean))].sort();
      uniqueVals.forEach((val) => {
        const opt = document.createElement("option");
        opt.value = String(val);
        opt.textContent = String(val);
        selectEl.appendChild(opt);
      });
    } catch (e) {
      console.warn(`Không thể tải danh sách lọc cho trường ${fieldName}:`, e);
    }
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

// 9. Hàm đếm số lượng cây xanh đang hiển thị
async function updateTreeCount() {
  const countEl = document.getElementById("treeCountVal");
  try {
    const q = cayXanhLayer.createQuery();
    q.where = cayXanhLayer.definitionExpression || "1=1";
    const count = await cayXanhLayer.queryFeatureCount(q);
    countEl.textContent = `${count} cây`;
  } catch {
    countEl.textContent = "N/A";
  }
}

// 10. Xây dựng biểu thức SQL (definitionExpression) kết hợp Tìm kiếm + 4 ô Lọc
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
    await view.goTo({ target: feat.geometry, zoom: 18 });
    view.openPopup({ features: [feat], location: feat.geometry });
  } else if (res.features.length > 1 && (zoomToResult || clauses.length > 0)) {
    const extRes = await cayXanhLayer.queryExtent({ where: whereClause });
    if (extRes && extRes.extent) {
      view.goTo(extRes.extent.expand(1.2));
    }
  }
}

// 11. Gắn sự kiện cho các nút Tìm kiếm, Lọc, Đặt lại và Ẩn/Hiện bảng thuộc tính
document.getElementById("btnSearch").addEventListener("click", () => applyCombinedFilter(true));
document.getElementById("searchInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyCombinedFilter(true);
});

document.getElementById("btnApplyFilter").addEventListener("click", () => applyCombinedFilter(true));

document.getElementById("btnResetFilter").addEventListener("click", async () => {
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

document.getElementById("btnToggleTable").addEventListener("click", () => {
  const panel = document.getElementById("tablePanel");
  panel.classList.toggle("hidden");
});