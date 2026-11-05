import esriConfig from "@arcgis/core/config.js";
import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import LayerList from "@arcgis/core/widgets/LayerList.js";
import Legend from "@arcgis/core/widgets/Legend.js";
import Home from "@arcgis/core/widgets/Home.js";
import ScaleBar from "@arcgis/core/widgets/ScaleBar.js";
import Basemap from "@arcgis/core/Basemap.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";

// 1. Cấu hình Portal URL & API Key (nếu dùng basemap từ ArcGIS Location Platform)
esriConfig.portalUrl = "https://hcmgis.esrivn.net/portal";
// Nếu bạn đã lấy API Key từ ArcGIS Location Platform, bỏ comment dòng dưới:
// esriConfig.apiKey = "YOUR_ARCGIS_LOCATION_PLATFORM_API_KEY";

const SERVICE_URL = "https://hcmgis.esrivn.net/server/rest/services/Hosted/CayXanh_GoVap_HaiAnh/FeatureServer";

// 2. Khởi tạo 4 lớp FeatureLayer từ dưới lên trên (Vùng -> Đường -> Điểm)
const ranhGioiPhuongLayer = new FeatureLayer({
  url: `${SERVICE_URL}/3`,
  title: "Ranh giới Phường (Gò Vấp)",
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
  outFields: ["*"],
  popupTemplate: {
    title: "Cây xanh: {macay} ({loaicay})",
    content: [
      {
        type: "fields",
        fieldInfos: [
          { fieldName: "macay", label: "Mã cây" },
          { fieldName: "loaicay", label: "Loài cây" },
          { fieldName: "tinhtrang", label: "Tình trạng" },
          { fieldName: "chieucao", label: "Chiều cao (m)" },
          { fieldName: "duongkinhthan", label: "Đường kính thân (cm)" },
          { fieldName: "duongkinhtan", label: "Đường kính tán (m)" },
          { fieldName: "namtrong", label: "Năm trồng" },
          { fieldName: "tenduong", label: "Tuyến đường" },
          { fieldName: "tenphuong", label: "Phường" },
          { fieldName: "donviquanly", label: "Đơn vị quản lý" }
        ]
      },
      {
        type: "attachments"
      }
    ]
  }
});

// 3. Khởi tạo đối tượng Map (Dùng basemap 'osm' hoặc 'streets-navigation-vector')
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

const map = new Map({
  basemap: osmBasemap,
  layers: [ranhGioiPhuongLayer, congVienLayer, tuyenDuongLayer, cayXanhLayer]
});

// 4. Khởi tạo MapView tâm điểm tại Quận Gò Vấp
const view = new MapView({
  container: "viewDiv",
  map: map,
  center: [106.665, 10.838], // Kinh độ, Vĩ độ Quận Gò Vấp
  zoom: 14
});

// 5. Thêm các công cụ điều khiển cơ bản (LayerList, Legend, Home, ScaleBar)
view.when(() => {
  // Tự động zoom tới phạm vi dữ liệu lớp cây xanh khi tải xong
  cayXanhLayer.when(() => {
    return cayXanhLayer.queryExtent();
  }).then((response) => {
    if (response.extent) {
      view.goTo(response.extent.expand(1.1));
    }
  });

  new LayerList({
    view: view,
    container: "layerListDiv"
  });

  new Legend({
    view: view,
    container: "legendDiv"
  });

  const homeBtn = new Home({ view: view });
  view.ui.add(homeBtn, "top-left");

  const scaleBar = new ScaleBar({
    view: view,
    unit: "metric"
  });
  view.ui.add(scaleBar, "bottom-left");
});