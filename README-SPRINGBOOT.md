# Arena3 — Backend Spring Boot (Java 17) trên Localhost

Backend của dự án Arena3 đã được refactor hoàn chỉnh sang **Spring Boot 3 (Java 17)** chạy trên **localhost:8088**.

---

## 1. Yêu cầu môi trường

- **Java**: JDK 17 (đã tích hợp sẵn tại `C:\Users\ADMIN\.jdks\corretto-17.0.12`).
- **Maven**: Đã tích hợp sẵn Maven Wrapper (`mvnw.cmd` / `mvnw`) trong thư mục `backend/` nên không cần cài đặt Maven toàn cục.
- **Cơ sở dữ liệu**:
  - Mặc định: H2 In-Memory chạy ở chế độ tương thích PostgreSQL, tự động nạp toàn bộ cấu hình, bảng giá, sân bãi và tài khoản demo khi khởi động.
  - Tùy chọn: Có thể kết nối PostgreSQL thật qua `application.yml` khi cần.

---

## 2. Cách khởi động Backend Spring Boot

Bạn có thể khởi động theo 1 trong các cách sau:

### Cách 1: Chạy bằng file `.bat` (Khuyên dùng trên Windows)
Nhấp đúp chuột vào file:
```
run-backend.bat
```
Hoặc mở Command Prompt / PowerShell:
```cmd
.\run-backend.bat
```

### Cách 2: Chạy bằng PowerShell
```powershell
.\run-backend.ps1
```

### Cách 3: Chạy trực tiếp bằng Maven Wrapper
```bash
cd backend
$env:JAVA_HOME="C:\Users\ADMIN\.jdks\corretto-17.0.12"
.\mvnw.cmd spring-boot:run
```

Backend sẽ khởi động tại: `http://localhost:8088`
Bảng điều khiển H2 Database (nếu muốn xem dữ liệu): `http://localhost:8088/h2-console` (JDBC URL: `jdbc:h2:mem:arena3`, user: `sa`, password: trống).

---

## 3. Khởi động Frontend (React / Vite)

Mở một cửa sổ dòng lệnh khác tại thư mục gốc của dự án:
```bash
npm run dev
```
Frontend sẽ chạy tại `http://localhost:8080`.
Frontend tự động chuyển tiếp tất cả các yêu cầu `/v1/*` sang backend Spring Boot tại `http://localhost:8088`.

---

## 4. Tài khoản Demo kiểm thử

Mật khẩu chung cho tất cả các tài khoản demo: **`ChangeMe!a3`**

| Vai trò | Số điện thoại | Quyền hạn |
|---|---|---|
| **Quản lý (Manager)** | `0900000001` | Xem báo cáo doanh thu, cài đặt hệ thống, quản lý lớp và gói tập |
| **Lễ tân (Receptionist)** | `0900000002` | Mở ca, chốt ca, tìm kiếm hội viên, thu ngân |
| **Huấn luyện viên (Coach)** | `0901110011` | Xem lịch dạy, điểm danh lớp học |
| **Hội viên (Member)** | `0901230101` | Đặt sân (hold / cancel), xem gói tập, trò chuyện cùng AI |

---

## 5. Kiểm thử tự động (API Verification)

Để kiểm tra toàn diện hoạt động của Backend Spring Boot:
```bash
$env:BASE="http://localhost:8088"
node scripts/arena3-api-check.mjs
```
Kết quả kiểm thử đạt **100% OK**:
- `GET /v1/plans`
- `GET /v1/classes`
- `GET /v1/price-rules`
- `POST /v1/auth/login` (cho cả 4 vai trò Manager, Receptionist, Coach, Member)
- `GET /v1/me`
- `GET /v1/occupancy`
- `GET /v1/reports/revenue` (kiểm tra phân quyền: Quản lý được phép, Hội viên nhận HTTP 403 Forbidden)
- `GET /v1/coach/schedule`
- `GET /v1/flags`
- `GET /v1/members?q=Nam`
- `POST /v1/bookings` (giữ chỗ theo bảng giá) & `POST /v1/bookings/:id/cancel`
- `POST /v1/assistant`
