# WebGIS Quản Lý Cây Xanh Đô Thị - Quận Gò Vấp

Ứng dụng WebGIS phục vụ công tác quản lý, tra cứu và theo dõi hiện trạng hệ thống cây xanh đô thị trên địa bàn Quận Gò Vấp, TP.HCM.

## Công nghệ sử dụng
- **Frontend Bundler:** Vite (Vanilla JavaScript ES Modules)
- **Bản đồ & GIS SDK:** ArcGIS Maps SDK for JavaScript (`@arcgis/core` v4.x)
- **Biểu đồ thống kê:** Chart.js
- **Dịch vụ GIS Backend:** ArcGIS Enterprise (`hcmgis.esrivn.net`) - Hosted Feature Service `CayXanh_GoVap_HaiAnh`

## Cấu trúc 4 lớp dữ liệu tích hợp
1. `CayXanh` (Point - Layer 0): Cây xanh đô thị kèm hình ảnh hiện trường (Attachments) và bảng quan hệ `LichSuChamSoc`.
2. `TuyenDuong` (Polyline - Layer 1): Mạng lưới tuyến đường giao thông Quận Gò Vấp.
3. `CongVien` (Polygon - Layer 2): Ranh giới các công viên, mảng xanh.
4. `RanhGioiPhuong` (Polygon - Layer 3): Ranh giới hành chính các phường thuộc Quận Gò Vấp.

## Hướng dẫn cài đặt và chạy dự án
```bash
npm install
npm run dev