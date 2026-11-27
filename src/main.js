import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import Basemap from "@arcgis/core/Basemap.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import Graphic from "@arcgis/core/Graphic.js";
import Circle from "@arcgis/core/geometry/Circle.js";
import Polygon from "@arcgis/core/geometry/Polygon.js";
import LayerList from "@arcgis/core/widgets/LayerList.js";
import Legend from "@arcgis/core/widgets/Legend.js";
import Home from "@arcgis/core/widgets/Home.js";
import ScaleBar from "@arcgis/core/widgets/ScaleBar.js";
import FeatureTable from "@arcgis/core/widgets/FeatureTable.js";
import Editor from "@arcgis/core/widgets/Editor.js";
import IdentityManager from "@arcgis/core/identity/IdentityManager.js";
import CustomContent from "@arcgis/core/popup/content/CustomContent.js";
import Chart from "chart.js/auto";

const PORTAL_TOKEN_URL = "https://hcmgis.esrivn.net/portal/sharing/rest/generateToken";
const SERVICE_URL =
  "https://hcmgis.esrivn.net/server/rest/services/Hosted/CayXanh_GoVap_HaiAnh/FeatureServer";

// ============================================================================
// 1. KHỞI TẠO CÁC BẢN ĐỒ NỀN (BASEMAPS - KHÔNG CẦN API KEY)
// ============================================================================
const BASEMAPS = {
  osm: new Basemap({
    baseLayers: [
      new WebTileLayer({
        urlTemplate: "https://{subDomain}.tile.openstreetmap.org/{level}/{col}/{row}.png",
        subDomains: ["a", "b", "c"],
        copyright: "© OpenStreetMap contributors"
      })
    ],
    title: "Bản đồ đường phố (OSM)",
    id: "osm-custom"
  }),
  satellite: new Basemap({
    baseLayers: [
      new WebTileLayer({
        urlTemplate:
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{level}/{row}/{col}",
        copyright: "Tiles © Esri — World Imagery"
      })
    ],
    title: "Ảnh vệ tinh (Esri Imagery)",
    id: "esri-imagery-custom"
  }),
  light: new Basemap({
    baseLayers: [
      new WebTileLayer({
        urlTemplate: "https://{subDomain}.basemaps.cartocdn.com/light_all/{level}/{col}/{row}.png",
        subDomains: ["a", "b", "c", "d"],
        copyright: "© OpenStreetMap contributors © CARTO"
      })
    ],
    title: "Nền sáng tối giản (Carto Light)",
    id: "carto-light-custom"
  })
};

// ============================================================================
// 2. KHỞI TẠO 4 LỚP KHÔNG GIAN, BẢNG QUAN HỆ & LỚP ĐỒ HỌA TRUY VẤN
// ============================================================================
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

const spatialGraphicsLayer = new GraphicsLayer({
  title: "Vùng truy vấn không gian",
  listMode: "hide"
});

const locateGraphicsLayer = new GraphicsLayer({
  title: "Vị trí GPS hiện tại",
  listMode: "hide"
});

// ============================================================================
// 3. KHỞI TẠO MAP & MAPVIEW
// ============================================================================
const map = new Map({
  basemap: BASEMAPS.osm,
  layers: [
    ranhGioiPhuongLayer,
    congVienLayer,
    tuyenDuongLayer,
    cayXanhLayer,
    spatialGraphicsLayer,
    locateGraphicsLayer
  ]
});

const view = new MapView({
  container: "viewDiv",
  map: map,
  center: [106.665, 10.838],
  zoom: 13
});

// ============================================================================
// 4. CÁC WIDGET ĐIỀU KHIỂN BẢN ĐỒ CƠ BẢN
// ============================================================================
view.ui.add(new Home({ view }), "top-left");
view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-left");
new LayerList({ view, container: "layerListDiv" });
new Legend({ view, container: "legendDiv" });

// ============================================================================
// 5. BẢNG THUỘC TÍNH (FEATURETABLE) & ĐỒNG BỘ CHỌN DÒNG
// ============================================================================
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

// ============================================================================
// 6. TỰ ĐỘNG NHẬN DIỆN SCHEMA & ÁNH XẠ DOMAIN TIẾNG VIỆT
// ============================================================================
const FIELD_MAP = {
  maCay: "MaCay",
  loaiCay: "LoaiCay",
  chieuCao: "ChieuCao",
  duongKinhThan: "DuongKinhThan",
  duongKinhTan: "DuongKinhTan",
  namTrong: "NamTrong",
  tuyenDuong: "TuyenDuong",
  phuong: "Phuong",
  tinhTrang: "TinhTrang",
  donViQuanLy: "DonViQuanLy",
  globalId: "GlobalID"
};

const CARE_FIELD_MAP = {
  foreignKey: "MaCay",
  ngayChamSoc: "NgayChamSoc",
  noiDung: "NoiDung",
  donVi: "DonViThucHien",
  ghiChu: "GhiChu"
};

const DOMAIN_FALLBACK = {
  // DM_TinhTrang
  Tot: "Tốt",
  CanCatTia: "Cần cắt tỉa",
  SauBenh: "Sâu bệnh",
  NguyHiem: "Nguy hiểm",
  // DM_LoaiCay
  SAO_DEN: "Sao đen",
  DAU_RAI: "Dầu rái",
  BANG_LANG: "Bằng lăng nước",
  PHUONG_VI: "Phượng vĩ",
  XA_CU: "Xà cừ",
  ME_TAY: "Me tây (Còng)",
  HOANG_NAM: "Hoàng nam",
  BANG_DAI_LOAN: "Bàng Đài Loan"
};

const STATUS_COLORS = {
  Tot: "#16a34a",
  CanCatTia: "#eab308",
  SauBenh: "#f97316",
  NguyHiem: "#dc2626"
};

const DOMAIN_LOOKUP = {};

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

function buildDomainLookup(fields) {
  fields.forEach((f) => {
    if (f.domain && Array.isArray(f.domain.codedValues)) {
      DOMAIN_LOOKUP[f.name] = {};
      f.domain.codedValues.forEach((cv) => {
        DOMAIN_LOOKUP[f.name][String(cv.code)] = cv.name;
      });
    }
  });
}

function getDomainLabel(fieldName, rawVal) {
  if (rawVal === null || rawVal === undefined || rawVal === "") return "Chưa xác định";
  const key = String(rawVal);
  if (DOMAIN_LOOKUP[fieldName] && DOMAIN_LOOKUP[fieldName][key]) {
    return DOMAIN_LOOKUP[fieldName][key];
  }
  if (DOMAIN_FALLBACK[key]) return DOMAIN_FALLBACK[key];
  return key;
}

// Trạng thái bộ lọc & hiển thị dùng chung toàn ứng dụng
let originalRenderer = null;
let stormFilterActive = false;
let activeSpatialGeometry = null;
let activeSpatialDescription = "";
let spatialDrawMode = null; // null | "radius" | "polygon"
let polygonVertices = [];

function buildActiveQuery(includeGeometry = false) {
  const q = cayXanhLayer.createQuery();
  q.where = cayXanhLayer.definitionExpression || "1=1";
  q.returnGeometry = includeGeometry;
  if (activeSpatialGeometry) {
    q.geometry = activeSpatialGeometry;
    q.spatialRelationship = "intersects";
  }
  return q;
}

// ============================================================================
// 7. KHI BẢN ĐỒ VÀ LỚP CÂY XANH TẢI XONG
// ============================================================================
view.when(async () => {
  try {
    await cayXanhLayer.load();

    const fields = cayXanhLayer.fields || [];
    FIELD_MAP.maCay = detectFieldName(fields, ["macay", "ma_cay"], "MaCay");
    FIELD_MAP.loaiCay = detectFieldName(fields, ["loaicay", "tencay", "loai_cay", "ten_cay"], "LoaiCay");
    FIELD_MAP.chieuCao = detectFieldName(fields, ["chieucao", "chieu_cao"], "ChieuCao");
    FIELD_MAP.duongKinhThan = detectFieldName(fields, ["duongkinhthan", "duong_kinh_than"], "DuongKinhThan");
    FIELD_MAP.duongKinhTan = detectFieldName(fields, ["duongkinhtan", "duong_kinh_tan"], "DuongKinhTan");
    FIELD_MAP.namTrong = detectFieldName(fields, ["namtrong", "nam_trong"], "NamTrong");
    FIELD_MAP.tuyenDuong = detectFieldName(fields, ["tuyenduong", "tenduong", "tuyen_duong", "ten_duong"], "TuyenDuong");
    FIELD_MAP.phuong = detectFieldName(fields, ["phuong", "tenphuong", "maphuong", "ten_phuong"], "Phuong");
    FIELD_MAP.tinhTrang = detectFieldName(fields, ["tinhtrang", "tinh_trang"], "TinhTrang");
    FIELD_MAP.donViQuanLy = detectFieldName(fields, ["donviquanly", "don_vi_quan_ly"], "DonViQuanLy");
    FIELD_MAP.globalId = detectFieldName(fields, ["globalid"], "GlobalID");

    buildDomainLookup(fields);

    // Lưu bản sao Renderer gốc từ ArcGIS Server để khôi phục sau khi đổi Heatmap / Cỡ tán
    if (cayXanhLayer.renderer) {
      originalRenderer = cayXanhLayer.renderer.clone();
    }

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

    // Cấu hình bảng quan hệ Lịch sử chăm sóc 1-N trong Popup
    if (cayXanhLayer.relationships && cayXanhLayer.relationships.length > 0) {
      const rel = cayXanhLayer.relationships[0];
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
    } catch (e) {
      console.warn("Bảng LichSuChamSoc chưa sẵn sàng hoặc khác ID:", e);
    }

    const extentRes = await cayXanhLayer.queryExtent();
    if (extentRes && extentRes.extent) {
      view.goTo(extentRes.extent.expand(1.15));
    }

    await populateFilterDropdowns();
    await updateTreeCount();

    // Đồng bộ bộ đếm, bảng thuộc tính và biểu đồ thống kê sau khi biên tập
    cayXanhLayer.on("edits", () => {
      updateTreeCount();
      if (featureTable) featureTable.refresh();
      const statsModal = document.getElementById("statsModal");
      if (statsModal && !statsModal.classList.contains("hidden")) {
        loadStatisticsDashboard();
      }
    });
  } catch (err) {
    console.error("Lỗi khi tải lớp Cây xanh:", err);
  }
});

// ============================================================================
// 8. CHỌN CÂY CHO NHẬT KÝ CHĂM SÓC & BẮT SỰ KIỆN TRUY VẤN KHÔNG GIAN
// ============================================================================
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
  const loaiCayVal = getDomainLabel(FIELD_MAP.loaiCay, feature.attributes[FIELD_MAP.loaiCay]);
  banner.textContent = `✅ Đang chọn cây: ${maCayVal} (${loaiCayVal})`;
  btnAdd.disabled = false;
}

view.on("click", async (event) => {
  // Nếu đang ở chế độ Chọn tâm bán kính
  if (spatialDrawMode === "radius") {
    event.stopPropagation();
    const radiusMeters = Math.max(50, Number(document.getElementById("radiusInput").value) || 300);
    const circleGeom = new Circle({
      center: event.mapPoint,
      radius: radiusMeters,
      radiusUnit: "meters",
      geodesic: true
    });

    spatialGraphicsLayer.removeAll();
    spatialGraphicsLayer.addMany([
      new Graphic({
        geometry: circleGeom,
        symbol: {
          type: "simple-fill",
          color: [37, 99, 235, 0.16],
          outline: { color: [29, 78, 216, 0.95], width: 2, style: "dash" }
        }
      }),
      new Graphic({
        geometry: event.mapPoint,
        symbol: {
          type: "simple-marker",
          color: "#dc2626",
          size: "10px",
          outline: { color: "#ffffff", width: 2 }
        }
      })
    ]);

    stopSpatialDrawingMode();
    await applySpatialFilter(circleGeom, `Vùng đệm bán kính ${radiusMeters} m`);
    return;
  }

  // Nếu đang ở chế độ Vẽ vùng chọn đa giác
  if (spatialDrawMode === "polygon") {
    event.stopPropagation();
    polygonVertices.push([event.mapPoint.x, event.mapPoint.y]);
    renderPolygonDraft();
    document.getElementById("spatialStatus").textContent =
      `Đang vẽ đa giác: đã chọn ${polygonVertices.length} đỉnh. Nhấn "✓ Hoàn tất" hoặc nhấp đúp để lọc.`;
    return;
  }

  // Chế độ bình thường: chọn cây để ghi nhật ký chăm sóc
  const hit = await view.hitTest(event);
  const treeHit = hit.results.find((r) => r.graphic && r.graphic.layer === cayXanhLayer);
  if (treeHit) {
    selectTreeForCareLog(treeHit.graphic);
  }
});

view.on("double-click", async (event) => {
  if (spatialDrawMode === "polygon") {
    event.stopPropagation();
    await finishPolygonSelection();
  }
});

const todayStr = new Date().toISOString().split("T")[0];
const careDateInput = document.getElementById("careDate");
if (careDateInput) careDateInput.value = todayStr;

// ============================================================================
// 9. PHÂN HỆ XÁC THỰC PORTAL (AUTHENTICATION) & EDITOR WIDGET (TUẦN 7)
// ============================================================================
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

// ============================================================================
// 10. LƯU BẢN GHI VÀO BẢNG QUAN HỆ LICHSUCHAMSOC QUA APPLYEDITS (TUẦN 7)
// ============================================================================
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

// ============================================================================
// 11. LỌC ĐA TIÊU CHÍ, TÌM KIẾM & CẢNH BÁO MÙA MƯA BÃO
// ============================================================================
async function populateOptionList(selectId, fieldName, useDomainLabel = false) {
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
        opt.textContent = useDomainLabel ? getDomainLabel(fieldName, val) : String(val);
        selectEl.appendChild(opt);
      }
    });
  } catch (err) {
    console.warn(`Không thể tải danh sách lọc cho trường ${fieldName}:`, err);
  }
}

async function populateFilterDropdowns() {
  await Promise.all([
    populateOptionList("filterPhuong", FIELD_MAP.phuong, false),
    populateOptionList("filterTuyenDuong", FIELD_MAP.tuyenDuong, false),
    populateOptionList("filterLoaiCay", FIELD_MAP.loaiCay, true),
    populateOptionList("filterTinhTrang", FIELD_MAP.tinhTrang, true)
  ]);
}

async function updateTreeCount() {
  const countEl = document.getElementById("treeCountVal");
  if (!countEl) return;
  try {
    const q = buildActiveQuery(false);
    const count = await cayXanhLayer.queryFeatureCount(q);
    countEl.textContent = `${count.toLocaleString("vi-VN")} cây`;
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

  if (stormFilterActive) {
    clauses.push(`${FIELD_MAP.tinhTrang} IN ('NguyHiem', 'CanCatTia')`);
  } else if (tinhTrang) {
    clauses.push(`${FIELD_MAP.tinhTrang} = '${tinhTrang}'`);
  }

  const whereClause = clauses.length > 0 ? clauses.join(" AND ") : "1=1";
  cayXanhLayer.definitionExpression = whereClause;

  await updateTreeCount();
  if (featureTable) featureTable.refresh();

  const q = buildActiveQuery(true);
  const res = await cayXanhLayer.queryFeatures(q);

  if (res.features.length === 1) {
    const feat = res.features[0];
    selectTreeForCareLog(feat);
    await view.goTo({ target: feat.geometry, zoom: 18 });
    view.openPopup({ features: [feat], location: feat.geometry });
  } else if (res.features.length > 1 && (zoomToResult || clauses.length > 0)) {
    const extRes = await cayXanhLayer.queryExtent(buildActiveQuery(false));
    if (extRes && extRes.extent) {
      view.goTo(extRes.extent.expand(1.2));
    }
  }
}

document.getElementById("btnSearch")?.addEventListener("click", () => applyCombinedFilter(true));
document.getElementById("searchInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyCombinedFilter(true);
});
document.getElementById("btnApplyFilter")?.addEventListener("click", () => {
  stormFilterActive = false;
  document.getElementById("btnStormFilter")?.classList.remove("active");
  applyCombinedFilter(true);
});

// Nút Cảnh báo mùa mưa bão (NguyHiem + CanCatTia)
document.getElementById("btnStormFilter")?.addEventListener("click", async () => {
  stormFilterActive = !stormFilterActive;
  const btn = document.getElementById("btnStormFilter");
  btn?.classList.toggle("active", stormFilterActive);
  if (stormFilterActive) {
    document.getElementById("filterTinhTrang").value = "";
  }
  await applyCombinedFilter(true);
});

document.getElementById("btnResetFilter")?.addEventListener("click", async () => {
  document.getElementById("searchInput").value = "";
  document.getElementById("filterPhuong").value = "";
  document.getElementById("filterTuyenDuong").value = "";
  document.getElementById("filterLoaiCay").value = "";
  document.getElementById("filterTinhTrang").value = "";
  stormFilterActive = false;
  document.getElementById("btnStormFilter")?.classList.remove("active");

  cayXanhLayer.definitionExpression = null;
  await clearSpatialFilter(false);
  view.closePopup();
  await updateTreeCount();
  if (featureTable) featureTable.refresh();

  const extRes = await cayXanhLayer.queryExtent();
  if (extRes && extRes.extent) {
    view.goTo(extRes.extent.expand(1.15));
  }
});

// ============================================================================
// 12. TRUY VẤN KHÔNG GIAN: BÁN KÍNH X MÉT & VẼ VÙNG ĐA GIÁC (ƯU TIÊN 3)
// ============================================================================
function stopSpatialDrawingMode() {
  spatialDrawMode = null;
  document.getElementById("viewDiv")?.classList.remove("drawing-cursor");
  document.getElementById("btnSpatialPolygon")?.classList.remove("active");
  document.getElementById("btnFinishPolygon")?.classList.add("hidden");
}

function renderPolygonDraft() {
  spatialGraphicsLayer.removeAll();
  polygonVertices.forEach((pt) => {
    spatialGraphicsLayer.add(
      new Graphic({
        geometry: {
          type: "point",
          x: pt[0],
          y: pt[1],
          spatialReference: view.spatialReference
        },
        symbol: {
          type: "simple-marker",
          color: "#1d4ed8",
          size: "7px",
          outline: { color: "#ffffff", width: 1.5 }
        }
      })
    );
  });

  if (polygonVertices.length >= 2) {
    const ring = [...polygonVertices, polygonVertices[0]];
    const geom =
      polygonVertices.length >= 3
        ? new Polygon({ rings: [ring], spatialReference: view.spatialReference })
        : { type: "polyline", paths: [polygonVertices], spatialReference: view.spatialReference };

    spatialGraphicsLayer.add(
      new Graphic({
        geometry: geom,
        symbol:
          polygonVertices.length >= 3
            ? {
                type: "simple-fill",
                color: [37, 99, 235, 0.16],
                outline: { color: [29, 78, 216, 0.95], width: 2 }
              }
            : {
                type: "simple-line",
                color: [29, 78, 216, 0.95],
                width: 2
              }
      })
    );
  }
}

async function applySpatialFilter(geometry, description) {
  activeSpatialGeometry = geometry;
  activeSpatialDescription = description;

  const lv = await view.whenLayerView(cayXanhLayer);
  lv.filter = {
    geometry: geometry,
    spatialRelationship: "intersects"
  };

  if (featureTable) {
    featureTable.filterGeometry = geometry;
    featureTable.refresh();
  }

  const count = await cayXanhLayer.queryFeatureCount(buildActiveQuery(false));
  document.getElementById("treeCountVal").textContent = `${count.toLocaleString("vi-VN")} cây`;
  document.getElementById("spatialStatus").textContent =
    `✅ ${description}: tìm thấy ${count.toLocaleString("vi-VN")} cây xanh thỏa mãn.`;

  if (geometry.extent) {
    view.goTo(geometry.extent.expand(1.35));
  }
}

async function finishPolygonSelection() {
  if (polygonVertices.length < 3) {
    document.getElementById("spatialStatus").textContent =
      "⚠️ Cần chọn tối thiểu 3 điểm trên bản đồ để tạo vùng đa giác!";
    return;
  }
  const ring = [...polygonVertices, polygonVertices[0]];
  const polyGeom = new Polygon({
    rings: [ring],
    spatialReference: view.spatialReference
  });
  renderPolygonDraft();
  stopSpatialDrawingMode();
  await applySpatialFilter(polyGeom, `Vùng chọn đa giác (${polygonVertices.length} đỉnh)`);
}

async function clearSpatialFilter(updateUi = true) {
  stopSpatialDrawingMode();
  polygonVertices = [];
  activeSpatialGeometry = null;
  activeSpatialDescription = "";
  spatialGraphicsLayer.removeAll();

  try {
    const lv = await view.whenLayerView(cayXanhLayer);
    lv.filter = null;
  } catch (err) {
    console.warn("Không thể xóa layerView.filter:", err);
  }

  if (featureTable) {
    featureTable.filterGeometry = null;
    featureTable.refresh();
  }

  if (updateUi) {
    document.getElementById("spatialStatus").textContent =
      "Chưa chọn vùng không gian. Chọn chế độ trên rồi nhấp vào bản đồ.";
    await updateTreeCount();
  }
}

document.getElementById("btnSpatialRadius")?.addEventListener("click", () => {
  polygonVertices = [];
  spatialDrawMode = "radius";
  document.getElementById("viewDiv")?.classList.add("drawing-cursor");
  document.getElementById("btnSpatialPolygon")?.classList.remove("active");
  document.getElementById("btnFinishPolygon")?.classList.add("hidden");
  const radius = Number(document.getElementById("radiusInput").value) || 300;
  document.getElementById("spatialStatus").textContent =
    `👉 Hãy nhấp vào 1 vị trí bất kỳ trên bản đồ để quét bán kính ${radius} m.`;
});

document.getElementById("btnSpatialPolygon")?.addEventListener("click", () => {
  polygonVertices = [];
  spatialGraphicsLayer.removeAll();
  spatialDrawMode = "polygon";
  document.getElementById("viewDiv")?.classList.add("drawing-cursor");
  document.getElementById("btnSpatialPolygon")?.classList.add("active");
  document.getElementById("btnFinishPolygon")?.classList.remove("hidden");
  document.getElementById("spatialStatus").textContent =
    '👉 Nhấp liên tiếp các đỉnh trên bản đồ để khoanh vùng, sau đó nhấn "✓ Hoàn tất" (hoặc nhấp đúp).';
});

document.getElementById("btnFinishPolygon")?.addEventListener("click", finishPolygonSelection);
document.getElementById("btnClearSpatial")?.addEventListener("click", () => clearSpatialFilter(true));

// ============================================================================
// 13. CHẾ ĐỘ HIỂN THỊ (ĐIỂM / CỠ TÁN / CLUSTERING / HEATMAP), BASEMAP & GPS
// ============================================================================
function setDisplayMode(mode) {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  if (mode === "standard") {
    cayXanhLayer.featureReduction = null;
    if (originalRenderer) cayXanhLayer.renderer = originalRenderer.clone();
    return;
  }

  if (mode === "canopy") {
    cayXanhLayer.featureReduction = null;
    cayXanhLayer.renderer = {
      type: "unique-value",
      field: FIELD_MAP.tinhTrang,
      defaultSymbol: {
        type: "simple-marker",
        color: "#64748b",
        outline: { color: "#ffffff", width: 1 }
      },
      uniqueValueInfos: [
        {
          value: "Tot",
          label: "Tốt",
          symbol: { type: "simple-marker", color: "#16a34a", outline: { color: "#ffffff", width: 1 } }
        },
        {
          value: "CanCatTia",
          label: "Cần cắt tỉa",
          symbol: { type: "simple-marker", color: "#eab308", outline: { color: "#ffffff", width: 1 } }
        },
        {
          value: "SauBenh",
          label: "Sâu bệnh",
          symbol: { type: "simple-marker", color: "#f97316", outline: { color: "#ffffff", width: 1 } }
        },
        {
          value: "NguyHiem",
          label: "Nguy hiểm",
          symbol: { type: "simple-marker", color: "#dc2626", outline: { color: "#ffffff", width: 1.2 } }
        }
      ],
      visualVariables: [
        {
          type: "size",
          field: FIELD_MAP.duongKinhTan,
          minDataValue: 1,
          maxDataValue: 14,
          minSize: 7,
          maxSize: 22
        }
      ]
    };
    return;
  }

  if (mode === "cluster") {
    if (originalRenderer) cayXanhLayer.renderer = originalRenderer.clone();
    cayXanhLayer.featureReduction = {
      type: "cluster",
      clusterRadius: "60px",
      clusterMinSize: "24px",
      clusterMaxSize: "52px",
      popupTemplate: {
        title: "🔵 Cụm cây xanh đô thị",
        content:
          "Khu vực này tập trung <strong>{cluster_count}</strong> cây xanh. Phóng to bản đồ để xem chi tiết từng cây."
      },
      labelingInfo: [
        {
          deconflictionStrategy: "none",
          labelExpressionInfo: {
            expression: "Text($feature.cluster_count, '#,###')"
          },
          symbol: {
            type: "text",
            color: "#ffffff",
            haloColor: "#1b5e20",
            haloSize: "1.5px",
            font: {
              weight: "bold",
              family: "Segoe UI",
              size: "12px"
            }
          },
          labelPlacement: "center-center"
        }
      ]
    };
    return;
  }

  if (mode === "heatmap") {
    cayXanhLayer.featureReduction = null;
    cayXanhLayer.renderer = {
      type: "heatmap",
      colorStops: [
        { ratio: 0, color: "rgba(34, 197, 94, 0)" },
        { ratio: 0.25, color: "rgba(134, 239, 172, 0.78)" },
        { ratio: 0.5, color: "rgba(250, 204, 21, 0.86)" },
        { ratio: 0.75, color: "rgba(249, 115, 22, 0.92)" },
        { ratio: 1, color: "rgba(220, 38, 38, 0.96)" }
      ],
      maxDensity: 0.04,
      minDensity: 0
    };
  }
}

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => setDisplayMode(btn.dataset.mode));
});

document.getElementById("basemapSelect")?.addEventListener("change", (e) => {
  const key = e.target.value;
  if (BASEMAPS[key]) {
    map.basemap = BASEMAPS[key];
  }
});

// Định vị vị trí hiện tại (GPS hiện trường)
document.getElementById("btnLocateMe")?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Trình duyệt không hỗ trợ định vị GPS.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { longitude, latitude } = pos.coords;
      const gpsPoint = { type: "point", longitude, latitude };
      locateGraphicsLayer.removeAll();
      locateGraphicsLayer.add(
        new Graphic({
          geometry: gpsPoint,
          symbol: {
            type: "simple-marker",
            color: "#2563eb",
            size: "13px",
            outline: { color: "#ffffff", width: 2.5 }
          },
          popupTemplate: {
            title: "📍 Vị trí hiện tại của bạn",
            content: `Kinh độ: <b>${longitude.toFixed(6)}</b><br/>Vĩ độ: <b>${latitude.toFixed(6)}</b>`
          }
        })
      );
      view.goTo({ target: [longitude, latitude], zoom: 17 });
    },
    (err) => {
      alert(`Không thể lấy vị trí GPS (${err.message}). Vui lòng cấp quyền vị trí trên trình duyệt.`);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// ============================================================================
// 14. DASHBOARD THỐNG KÊ & BIỂU ĐỒ (OUTSTATISTICS + CHART.JS - ƯU TIÊN 1)
// ============================================================================
const chartInstances = {
  status: null,
  ward: null,
  species: null
};

async function queryGroupedStats(groupField) {
  const oidField = cayXanhLayer.objectIdField || "objectid";
  const q = buildActiveQuery(false);
  q.groupByFieldsForStatistics = [groupField];
  q.outStatistics = [
    {
      statisticType: "count",
      onStatisticField: oidField,
      outStatisticFieldName: "tree_count"
    }
  ];
  const res = await cayXanhLayer.queryFeatures(q);
  return res.features
    .map((f) => ({
      code: f.attributes[groupField],
      label: getDomainLabel(groupField, f.attributes[groupField]),
      count: Number(f.attributes.tree_count || 0)
    }))
    .sort((a, b) => b.count - a.count);
}

async function queryAverageMetrics() {
  const q = buildActiveQuery(false);
  q.outStatistics = [
    {
      statisticType: "avg",
      onStatisticField: FIELD_MAP.chieuCao,
      outStatisticFieldName: "avg_height"
    },
    {
      statisticType: "avg",
      onStatisticField: FIELD_MAP.duongKinhTan,
      outStatisticFieldName: "avg_canopy"
    }
  ];
  try {
    const res = await cayXanhLayer.queryFeatures(q);
    if (res.features.length > 0) {
      const attrs = res.features[0].attributes;
      return {
        avgHeight: attrs.avg_height ? Number(attrs.avg_height).toFixed(1) : "--",
        avgCanopy: attrs.avg_canopy ? Number(attrs.avg_canopy).toFixed(1) : "--"
      };
    }
  } catch (err) {
    console.warn("Không thể tính trung bình chiều cao/đường kính tán:", err);
  }
  return { avgHeight: "--", avgCanopy: "--" };
}

function renderChart(key, canvasId, config) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    chartInstances[key] = null;
  }
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartInstances[key] = new Chart(ctx, config);
}

async function loadStormPriorityTable() {
  const tbody = document.getElementById("stormTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b">Đang truy vấn danh sách ưu tiên...</td></tr>`;

  try {
    const q = buildActiveQuery(true);
    const stormCond = `${FIELD_MAP.tinhTrang} IN ('NguyHiem', 'CanCatTia')`;
    q.where = q.where && q.where !== "1=1" ? `(${q.where}) AND ${stormCond}` : stormCond;
    q.orderByFields = [`${FIELD_MAP.chieuCao} DESC`];
    q.num = 30;

    const res = await cayXanhLayer.queryFeatures(q);
    const features = [...res.features].sort((a, b) => {
      const aDanger = a.attributes[FIELD_MAP.tinhTrang] === "NguyHiem" ? 0 : 1;
      const bDanger = b.attributes[FIELD_MAP.tinhTrang] === "NguyHiem" ? 0 : 1;
      if (aDanger !== bDanger) return aDanger - bDanger;
      return (Number(b.attributes[FIELD_MAP.chieuCao]) || 0) - (Number(a.attributes[FIELD_MAP.chieuCao]) || 0);
    });

    if (features.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#15803d;font-weight:600">✅ Không có cây Nguy hiểm hoặc Cần cắt tỉa trong phạm vi hiện tại.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    features.forEach((feat) => {
      const a = feat.attributes;
      const isDanger = a[FIELD_MAP.tinhTrang] === "NguyHiem";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${a[FIELD_MAP.maCay] || "-"}</strong></td>
        <td>${getDomainLabel(FIELD_MAP.loaiCay, a[FIELD_MAP.loaiCay])}</td>
        <td>${a[FIELD_MAP.tuyenDuong] || "-"}</td>
        <td>${a[FIELD_MAP.phuong] || "-"}</td>
        <td>${a[FIELD_MAP.chieuCao] ?? "-"}</td>
        <td>
          <span class="status-pill ${isDanger ? "pill-danger" : "pill-warn"}">
            ${getDomainLabel(FIELD_MAP.tinhTrang, a[FIELD_MAP.tinhTrang])}
          </span>
        </td>
        <td><button class="btn-zoom-tree">📍 Xem</button></td>
      `;
      tr.querySelector(".btn-zoom-tree").addEventListener("click", async () => {
        document.getElementById("statsModal").classList.add("hidden");
        selectTreeForCareLog(feat);
        await view.goTo({ target: feat.geometry, zoom: 19 });
        view.openPopup({ features: [feat], location: feat.geometry });
      });
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#dc2626">Lỗi tải danh sách mưa bão: ${err.message}</td></tr>`;
  }
}

async function loadStatisticsDashboard() {
  const scopeParts = [];
  if (cayXanhLayer.definitionExpression && cayXanhLayer.definitionExpression !== "1=1") {
    scopeParts.push("Đang áp dụng bộ lọc thuộc tính");
  }
  if (activeSpatialDescription) {
    scopeParts.push(activeSpatialDescription);
  }
  document.getElementById("statsScopeLabel").textContent =
    scopeParts.length > 0
      ? `Phạm vi thống kê: ${scopeParts.join(" + ")}`
      : "Phạm vi thống kê: Toàn bộ dữ liệu Quận Gò Vấp";

  try {
    const [statusStats, wardStats, speciesStats, avgMetrics] = await Promise.all([
      queryGroupedStats(FIELD_MAP.tinhTrang),
      queryGroupedStats(FIELD_MAP.phuong),
      queryGroupedStats(FIELD_MAP.loaiCay),
      queryAverageMetrics()
    ]);

    const total = statusStats.reduce((sum, item) => sum + item.count, 0);
    const countOf = (code) => statusStats.find((s) => s.code === code)?.count || 0;
    const goodCount = countOf("Tot");
    const warnCount = countOf("CanCatTia") + countOf("SauBenh");
    const dangerCount = countOf("NguyHiem");

    const pct = (n) => (total > 0 ? ((n / total) * 100).toFixed(1) : "0.0");

    document.getElementById("kpiTotal").textContent = total.toLocaleString("vi-VN");
    document.getElementById("kpiAvgSize").textContent =
      `Cao TB: ${avgMetrics.avgHeight} m | Tán TB: ${avgMetrics.avgCanopy} m`;

    document.getElementById("kpiGood").textContent = goodCount.toLocaleString("vi-VN");
    document.getElementById("kpiGoodPct").textContent = `${pct(goodCount)}% tổng số cây`;

    document.getElementById("kpiWarn").textContent = warnCount.toLocaleString("vi-VN");
    document.getElementById("kpiWarnPct").textContent = `${pct(warnCount)}% cần lên lịch chăm sóc`;

    document.getElementById("kpiDanger").textContent = dangerCount.toLocaleString("vi-VN");
    document.getElementById("kpiDangerPct").textContent = `${pct(dangerCount)}% cần xử lý khẩn cấp`;

    // Biểu đồ 1: Doughnut theo Tình trạng
    renderChart("status", "chartStatus", {
      type: "doughnut",
      data: {
        labels: statusStats.map((s) => s.label),
        datasets: [
          {
            data: statusStats.map((s) => s.count),
            backgroundColor: statusStats.map((s) => STATUS_COLORS[s.code] || "#64748b"),
            borderWidth: 2,
            borderColor: "#ffffff"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right" }
        }
      }
    });

    // Biểu đồ 2: Cột theo Phường
    renderChart("ward", "chartWard", {
      type: "bar",
      data: {
        labels: wardStats.map((w) => w.label),
        datasets: [
          {
            label: "Số lượng cây",
            data: wardStats.map((w) => w.count),
            backgroundColor: "#2e7d32",
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    // Biểu đồ 3: Thanh ngang theo Loài cây
    renderChart("species", "chartSpecies", {
      type: "bar",
      data: {
        labels: speciesStats.map((s) => s.label),
        datasets: [
          {
            label: "Số lượng cây",
            data: speciesStats.map((s) => s.count),
            backgroundColor: "#0f766e",
            borderRadius: 5
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    });

    await loadStormPriorityTable();
  } catch (err) {
    console.error("Lỗi khi tải Dashboard Thống kê:", err);
  }
}

document.getElementById("btnOpenStats")?.addEventListener("click", () => {
  document.getElementById("statsModal").classList.remove("hidden");
  loadStatisticsDashboard();
});
document.getElementById("btnCloseStats")?.addEventListener("click", () => {
  document.getElementById("statsModal").classList.add("hidden");
});
document.getElementById("btnRefreshStats")?.addEventListener("click", loadStatisticsDashboard);
document.getElementById("btnApplyStormFromStats")?.addEventListener("click", async () => {
  document.getElementById("statsModal").classList.add("hidden");
  stormFilterActive = true;
  document.getElementById("btnStormFilter")?.classList.add("active");
  document.getElementById("filterTinhTrang").value = "";
  await applyCombinedFilter(true);
});

// ============================================================================
// 15. XUẤT BÁO CÁO CSV CHUẨN TIẾNG VIỆT (PHÂN TRANG ĐỦ TOÀN BỘ BẢN GHI)
// ============================================================================
async function exportFilteredTreesToCsv() {
  const btn = document.getElementById("btnExportCsv");
  const originalText = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Đang xuất...";
  }

  try {
    const allFeatures = [];
    const pageSize = 1000;
    let start = 0;

    while (true) {
      const q = buildActiveQuery(false);
      q.outFields = [
        FIELD_MAP.maCay,
        FIELD_MAP.loaiCay,
        FIELD_MAP.chieuCao,
        FIELD_MAP.duongKinhThan,
        FIELD_MAP.duongKinhTan,
        FIELD_MAP.namTrong,
        FIELD_MAP.tinhTrang,
        FIELD_MAP.tuyenDuong,
        FIELD_MAP.phuong,
        FIELD_MAP.donViQuanLy
      ];
      q.start = start;
      q.num = pageSize;
      q.orderByFields = [`${FIELD_MAP.maCay} ASC`];

      const res = await cayXanhLayer.queryFeatures(q);
      allFeatures.push(...res.features);

      if (!res.exceededTransferLimit && res.features.length < pageSize) {
        break;
      }
      start += pageSize;
      if (start > 20000) break; // Chốt an toàn
    }

    if (allFeatures.length === 0) {
      alert("Không có dữ liệu cây xanh nào để xuất CSV!");
      return;
    }

    const headers = [
      "Mã cây",
      "Loài cây",
      "Chiều cao (m)",
      "Đường kính thân (cm)",
      "Đường kính tán (m)",
      "Năm trồng",
      "Tình trạng",
      "Tuyến đường",
      "Phường",
      "Đơn vị quản lý"
    ];

    const escapeCsv = (val) => {
      const str = val === null || val === undefined ? "" : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = allFeatures.map((f) => {
      const a = f.attributes;
      return [
        a[FIELD_MAP.maCay],
        getDomainLabel(FIELD_MAP.loaiCay, a[FIELD_MAP.loaiCay]),
        a[FIELD_MAP.chieuCao],
        a[FIELD_MAP.duongKinhThan],
        a[FIELD_MAP.duongKinhTan],
        a[FIELD_MAP.namTrong],
        getDomainLabel(FIELD_MAP.tinhTrang, a[FIELD_MAP.tinhTrang]),
        a[FIELD_MAP.tuyenDuong],
        a[FIELD_MAP.phuong],
        a[FIELD_MAP.donViQuanLy]
      ]
        .map(escapeCsv)
        .join(",");
    });

    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `DanhSachCayXanh_GoVap_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Xuất CSV thất bại: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

document.getElementById("btnExportCsv")?.addEventListener("click", exportFilteredTreesToCsv);
document.getElementById("btnStatsExportCsv")?.addEventListener("click", exportFilteredTreesToCsv);

// ============================================================================
// 16. XUẤT ẢNH & IN BẢN ĐỒ BÁO CÁO (VIEWTASK SCREENSHOT + CANVAS LAYOUT)
// ============================================================================
let composedMapDataUrl = "";

async function generatePrintableMapImage() {
  const wrap = document.getElementById("printPreviewWrap");
  wrap.innerHTML = `<p class="print-loading">⏳ Đang kết xuất bản đồ độ phân giải cao...</p>`;

  try {
    const screenshot = await view.takeScreenshot({ format: "png", quality: 95 });
    const img = new Image();
    img.src = screenshot.dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const headerH = 74;
    const footerH = 54;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height + headerH + footerH;
    const ctx = canvas.getContext("2d");

    // Khung tiêu đề phía trên
    ctx.fillStyle = "#1b5e20";
    ctx.fillRect(0, 0, canvas.width, headerH);

    const titleText =
      document.getElementById("printTitleInput").value.trim() ||
      "BẢN ĐỒ HIỆN TRẠNG CÂY XANH ĐÔ THỊ - QUẬN GÒ VẤP";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Segoe UI, sans-serif";
    ctx.fillText(titleText, 20, 34);

    const countText = document.getElementById("treeCountVal")?.textContent || "";
    const dateText = new Date().toLocaleString("vi-VN");
    const subInfo = `Ngày xuất: ${dateText}  |  Hiển thị: ${countText}${
      activeSpatialDescription ? `  |  ${activeSpatialDescription}` : ""
    }`;
    ctx.fillStyle = "#dcfce7";
    ctx.font = "14px Segoe UI, sans-serif";
    ctx.fillText(subInfo, 20, 58);

    // Ảnh bản đồ chính
    ctx.drawImage(img, 0, headerH);

    // Khung chú giải phía dưới
    const footerY = headerH + img.height;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, footerY, canvas.width, footerH);
    ctx.strokeStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(0, footerY);
    ctx.lineTo(canvas.width, footerY);
    ctx.stroke();

    const legendItems = [
      { label: "Tốt", color: "#16a34a" },
      { label: "Cần cắt tỉa", color: "#eab308" },
      { label: "Sâu bệnh", color: "#f97316" },
      { label: "Nguy hiểm", color: "#dc2626" }
    ];

    let xPos = 22;
    ctx.font = "bold 14px Segoe UI, sans-serif";
    ctx.fillStyle = "#1e293b";
    ctx.fillText("Chú giải tình trạng:", xPos, footerY + 32);
    xPos += 145;

    ctx.font = "14px Segoe UI, sans-serif";
    legendItems.forEach((item) => {
      ctx.beginPath();
      ctx.arc(xPos, footerY + 27, 7, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#334155";
      ctx.fillText(item.label, xPos + 14, footerY + 32);
      xPos += 115;
    });

    composedMapDataUrl = canvas.toDataURL("image/png");
    wrap.innerHTML = `<img src="${composedMapDataUrl}" alt="Bản đồ xuất báo cáo" />`;
  } catch (err) {
    wrap.innerHTML = `<p class="error-msg">❌ Không thể kết xuất ảnh bản đồ: ${err.message}</p>`;
  }
}

document.getElementById("btnPrintMap")?.addEventListener("click", () => {
  document.getElementById("printModal").classList.remove("hidden");
  generatePrintableMapImage();
});
document.getElementById("btnClosePrint")?.addEventListener("click", () => {
  document.getElementById("printModal").classList.add("hidden");
});
document.getElementById("btnRegeneratePrint")?.addEventListener("click", generatePrintableMapImage);

document.getElementById("btnDownloadPng")?.addEventListener("click", () => {
  if (!composedMapDataUrl) return;
  const link = document.createElement("a");
  link.href = composedMapDataUrl;
  link.download = `BanDo_CayXanh_GoVap_${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

document.getElementById("btnBrowserPrint")?.addEventListener("click", () => {
  if (!composedMapDataUrl) return;
  const printWin = window.open("", "_blank");
  if (!printWin) {
    alert("Trình duyệt đang chặn cửa sổ bật lên (Popup). Vui lòng cho phép để in bản đồ.");
    return;
  }
  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <title>In bản đồ Cây xanh Quận Gò Vấp</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          body { margin: 0; display: flex; justify-content: center; align-items: center; }
          img { max-width: 100%; max-height: 98vh; }
        </style>
      </head>
      <body>
        <img src="${composedMapDataUrl}" onload="window.print(); window.close();" />
      </body>
    </html>
  `);
  printWin.document.close();
});

// ============================================================================
// 17. ĐIỀU KHIỂN GIAO DIỆN (BẢNG THUỘC TÍNH & MENU RESPONSIVE DI ĐỘNG)
// ============================================================================
document.getElementById("btnToggleTable")?.addEventListener("click", () => {
  document.getElementById("tablePanel")?.classList.toggle("hidden");
});

document.getElementById("btnToggleSidebar")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("mobile-closed");
});