# Kịch bản thuyết trình — Người 1 | ⏱ 10 PHÚT

> **Bối cảnh:** 3 bạn trước đã nói overview + giới thiệu TestNG lý thuyết.
> **Nhiệm vụ:** kéo lý thuyết đó xuống code thật đang chạy.
> **Giới hạn: 10 phút** — kịch bản đã canh đúng thời lượng này.

---

## ⚠️ BA LUẬT CỦA BÀI NÀY

**1. Gõ lệnh chạy test ngay ở giây thứ 30, rồi nói tiếp trong lúc nó build.**
Build mất 20–40 giây. Đứng im chờ là mất gần 1/15 thời lượng.

**2. Gieo hạt "3 test trượt" sớm, nhưng khoan giải thích.**
Kết quả hiện ra ở phút thứ 1:30 — chỉ vào, nói *"em sẽ quay lại"*, rồi đi tiếp.
Khán giả sẽ tò mò suốt 4 phút sau đó.

**3. Phần 3 lỗi phải còn đủ 3 phút 15.** Nhìn đồng hồ ở mốc **5:00** — chưa tới
phần đó thì bỏ ngay phần đang nói mà nhảy vào.

---

## 🎯 BA KEY

> **KEY 1 — Test chạy không cần database**, ~2 giây, máy nào cũng chạy.
> Vì vậy nó **thực sự được chạy**, chứ không nằm chết trong repo.

> **KEY 2 — Chia bài cho 2 người chỉ tốn 2 file XML**, không sửa một dòng Java.
> "Cấu hình linh hoạt" mà các bạn vừa nghe — nhìn thấy bằng mắt.

> **KEY 3 — Bộ test của em trượt 3 cái, và đó là phần giá trị nhất.**
> Cả 3 đều là lỗi thật trong code tính tiền. Bấm tay không đời nào tìm ra.

**Câu chốt — học thuộc nguyên văn:**

> *"Một bộ test toàn màu xanh không chứng minh code đúng — nhiều khi nó chỉ
> chứng minh mình chưa hỏi đủ khó."*

---

## ❌ KHÔNG NÓI (3 bạn trước đã dùng hết)

- TestNG là gì, so với JUnit
- Đọc danh sách annotation `@Test`, `@BeforeMethod`…
- Ưu điểm chung của kiểm thử tự động
- **Giảng lại** 5 thành phần kiến trúc → chỉ **chỉ ra chúng nằm ở file nào**

---

# KỊCH BẢN

## ⏱ 0:00 – 0:30 | Mở đầu + bấm chạy

**Nói (vừa nói vừa chuyển sang terminal):**

> "Ba bạn vừa rồi đã trình bày TestNG về mặt lý thuyết. Phần của em ngược lại:
> em mở code thật của hệ thống Arena3, chỉ ra từng thứ vừa nghe nằm ở dòng nào,
> rồi chạy trực tiếp cho cả lớp xem — kể cả những test trượt."

**Gõ luôn, đừng chờ:**

```powershell
.\run-tests.ps1 1
```

> "Em cho chạy trước, trong lúc chờ em giới thiệu code."

---

## ⏱ 0:30 – 1:30 | Code đang được test (nói đè lên lúc build)

**Chiếu:** `PricingService.java`

> "Arena3 là hệ thống quản lý trung tâm thể thao — đặt sân cầu lông, bóng rổ.
> Em không test cả hệ thống, em chọn 2 lớp nghiệp vụ khó nhất, tức là 2 chỗ nếu
> sai thì **mất tiền thật**: `PricingService` tính tiền, và
> `CourtBookingService` giữ chỗ sân. Em phụ trách lớp tính tiền."

**Chỉ vào constructor:**

```java
public PricingService(PriceRuleRepository priceRuleRepository, ...)
```

**KEY 1 — nói chậm chỗ này:**

> "Chi tiết này quyết định cả bài: service **không tự tạo** repository bên trong
> mà **nhận từ ngoài vào qua constructor**. Nhờ vậy lúc test em truyền đồ giả
> thay cho database thật."

> "Kết quả: toàn bộ test chạy **không cần cài Postgres**, xong trong khoảng 2
> giây, máy ai cũng chạy được. Đó là lý do bộ test này thực sự được dùng chứ
> không nằm chết trong repo."

---

## ⏱ 1:30 – 1:50 | 🌱 Gieo hạt (20 giây, đừng giải thích vội)

**Kết quả vừa hiện ra. Chỉ vào dòng cuối:**

```
Tổng lượt chạy: 11   Đạt: 8   Thất bại: 3
```

> "Xong rồi ạ — 2 giây. Các bạn để ý dòng cuối: **3 test trượt**. Em **cố ý để
> nó trượt**, và đó là phần chính của em. Nhưng em xin quay lại sau, giờ em nói
> về cấu trúc đã."

🎯 *Đừng giải thích ngay. Để họ tò mò 3 phút.*

---

## ⏱ 1:50 – 2:35 | File nào là file "chạy"?

**Tự đặt câu hỏi rồi tự trả lời:**

> "Nhóm em thêm 7 file vào dự án. Câu hỏi là: file nào mình 'chạy'? Câu trả lời
> là **không có file nào chạy một mình** — nó là một chuỗi."

**Chiếu:**

```
run-tests.ps1                    ← em gõ lệnh ở đây
   │  đặt JAVA_HOME, bật UTF-8, chọn profile
   ▼
mvnw.cmd  →  pom.xml             ← profile quyết định dùng suite XML nào
   ▼
maven-surefire-plugin            ← plugin chạy test, sinh báo cáo
   ▼
testng-module1-pricing.xml       ← liệt kê class nào chạy + đăng ký listener
   ▼
PricingServiceTest.java          ← code test thật sự nằm ở đây
```

> "Lệnh em vừa gõ là mắt xích trên cùng. Nó đi xuống qua Maven, qua plugin
> Surefire, tới file XML, cuối cùng mới tới code test."

---

## ⏱ 2:35 – 3:15 | Lý thuyết vừa nghe nằm ở đâu trong code

**Nói trước — để không bị coi là nói trùng:**

> "Em **không nhắc lại** 5 thành phần kiến trúc, các bạn vừa nghe rồi. Em chỉ
> chỉ ra mỗi thành phần đó **nằm ở file nào trong dự án em**."

| Thành phần (vừa nghe) | Nằm ở đâu trong Arena3 |
|---|---|
| TestNG Engine | Surefire khởi động qua `surefire-testng` |
| XML Configuration | 3 file `testng*.xml` |
| Annotation Processor | Đọc `@Test`, `@DataProvider` trong class test |
| Data Provider | `timePriceProvider` — 4 bộ dữ liệu |
| Listener & Reporter | **`ConsoleNarrator` nhóm em tự viết** |

**Dừng ở dòng cuối — đây là chỗ đáng khoe nhất:**

> "Dòng chữ tiếng Việt các bạn vừa thấy chạy trên màn hình — nó **không phải
> của TestNG**. Nó là class nhóm em tự viết, chỉ cần `implements ITestListener`
> là TestNG tự gọi đúng hàm vào đúng thời điểm."

> "Nhóm em **không sửa TestNG**, chỉ cắm thêm một mảnh vào chỗ nó chừa sẵn. Đó
> mới là ý nghĩa thật của chữ *mở rộng được*."

---

## ⏱ 3:15 – 4:00 | Sự cố nhóm em vấp phải 🔧

> "Chỗ này nhóm em mất thời gian nhất, em xin kể vì nó là bài học thật."

> "Lúc đầu chạy ra thế này: `Ki?m tra c?ng th?c` — **dấu hỏi hết**. Em tưởng
> code sai, nhưng không."

> "Nguyên nhân: console Windows mặc định ở **code page 437**, bảng mã đó **không
> có chữ tiếng Việt**. Mà JDK 17 khi in ra console thật thì mã hoá theo code
> page của console, **không theo `file.encoding`** như nhóm em vẫn tưởng."

> "Nên phải sửa **cả hai phía**: `chcp 65001` cho console, và
> `-Dsun.stdout.encoding=UTF-8` cho JVM. Sửa một bên thôi là vẫn ra dấu hỏi.
> Cả hai lệnh đó giờ nằm sẵn trong `run-tests.ps1`, nên em chỉ cần gõ một lệnh."

🎯 *Đoạn này rất đáng kể: nó chứng minh nhóm tự debug chứ không copy hướng dẫn.*

---

## ⏱ 4:00 – 5:15 | 8 test ĐẠT nói lên điều gì

**Chặn thắc mắc trước:**

> "Em viết **8 hàm** test nhưng báo **11 lượt chạy** — không phải lỗi."

**Chiếu bảng dữ liệu:**

| Thời điểm | Giá | Cao điểm? |
|---|---|---|
| Thứ 4, 09:00 | 80.000đ | Không |
| Thứ 4, 18:00 | 140.000đ | Có |
| Chủ nhật, 07:00 | 80.000đ | Không |
| Chủ nhật, 10:00 | 140.000đ | **Có** |

> "Một hàm test dùng `@DataProvider` với 4 bộ dữ liệu này, nên nó chạy 4 lần.
> TestNG đếm theo **lượt chạy thực tế**, không đếm theo số hàm."

> "Dòng cuối là chỗ dễ sai: 10 giờ sáng ngày thường thì rẻ, nhưng 10 giờ sáng
> **chủ nhật** đã là giá cao điểm, vì cuối tuần cao điểm bắt đầu từ 8 giờ."

> "Muốn thêm ca 'thứ 7 lúc 10 giờ đêm' thì em **thêm một dòng dữ liệu**, không
> viết thêm hàm test nào."

**Cặp test đáng nói nhất:**

| Tình huống | Kỳ vọng |
|---|---|
| Gói **cầu lông** còn hạn | Giảm **20%** |
| Gói **bóng rổ**, đặt sân **cầu lông** | Giảm **0%** |

> "Cặp này em cố ý viết thành đôi: một cái chứng minh tính năng **chạy đúng khi
> được phép**, một cái chứng minh nó **không chạy khi không được phép**. Thiếu
> cái thứ hai thì lỗi 'giảm giá cho mọi môn' lọt hoàn toàn."

---

## ⏱ 5:15 – 8:30 | ⭐ BA TEST TRƯỢT (phần chính)

**Mở — dứt khoát, không xin lỗi:**

> "Giờ em quay lại 3 test trượt lúc nãy. Em **không sửa cho nó xanh**. Cả 3 đều
> trượt vì **code có lỗi thật**, không phải vì em viết sai kỳ vọng. Và cố ý là
> **3 loại lỗi khác nhau**."

### Lỗi 1 — Quên đọc một trường dữ liệu (55 giây)

```
expected [0] but found [20]
```

> "Khách mua trước gói tập, 10 ngày nữa mới tới ngày bắt đầu. Hôm nay đặt sân
> **đã được giảm 20%** rồi."

```java
if (!s.getEndOn().isBefore(today)) {     // chỉ kiểm tra ngày KẾT THÚC
```

> "Trường `startOn` — ngày bắt đầu — **có trong dữ liệu nhưng không hề được
> dùng**. Nên gói nào cũng bị coi như đã có hiệu lực. Sửa thì chỉ cần thêm một
> điều kiện kiểm tra `startOn`."

### Lỗi 2 — Quên chặn giá trị biên (50 giây)

> "Admin nhập nhầm **150%** thay vì 15%. Giá sân 140 nghìn thành **âm 70
> nghìn** — tức là trung tâm phải trả tiền cho khách."

```java
if (pct <= 0) return list;    // chặn cận DƯỚI, quên cận TRÊN
```

> "Code có chặn phần trăm âm, nhưng quên chặn trần. Đây là kiểu lỗi kinh điển:
> nghĩ tới một đầu mà quên đầu kia."

### Lỗi 3 — Sai hướng làm tròn (60 giây) ⭐ kể kỹ nhất

**Chiếu to:**

```
Giá sân:        140.000đ
Giảm 13%:       140.000 × 0,87 = 121.800đ
Hệ thống thu:                    122.000đ
                               ──────────
Khách trả dư:                        200đ
```

> "Nguyên nhân là `Math.round` — nó làm tròn về số **gần nhất**, nên 121,8
> nghìn thành 122 nghìn, tức là làm tròn **lên**."

> "200 đồng nghe rất nhỏ. Nhưng thứ nhất, nhân với hàng nghìn lượt đặt sân thì
> thành tiền thật. Thứ hai, và quan trọng hơn: đây là **thu sai so với giá mà
> trung tâm đã công bố**. Cách sửa là dùng `Math.floor` — làm tròn xuống,
> nghiêng về phía có lợi cho khách."

### 🎤 CHỐT (40 giây) — học thuộc đoạn này

> "Em muốn nói 3 ý về 3 cái lỗi này."

> "**Một**, cả 3 đều **vô hình với kiểm thử thủ công**. Bấm tay trên giao diện
> thì ai cũng chỉ thử trường hợp bình thường — gói đang còn hạn, giảm 15%, giá
> tròn số. Không ai nghĩ tới gói *chưa bắt đầu*, hay gõ nhầm *150%*."

> "**Hai**, và đây mới đáng sợ: **8 test đạt kia không cứu được**. Em đã có sẵn
> test kiểm tra chiết khấu, có sẵn test kiểm tra làm tròn. Nhưng cả hai chỉ thử
> **trường hợp đẹp**. Lỗi nằm ở **trường hợp biên**, chỗ chưa ai hỏi tới."

> "**Ba**, 3 lỗi thuộc 3 loại khác nhau: một cái **quên đọc dữ liệu**, một cái
> **quên chặn biên**, một cái **sai hướng làm tròn**."

> "Nên nếu bài của em toàn màu xanh, em nghĩ nó còn **kém tin cậy hơn** bây giờ.
> Một bộ test toàn xanh không chứng minh code đúng — nhiều khi nó chỉ chứng minh
> **mình chưa hỏi đủ khó**."

---

## ⏱ 8:30 – 9:20 | KEY 2 + chuyển cho người 2

> "Một điểm cuối. Để chia bài cho 2 người chạy riêng, nhóm em **chỉ thêm 2 file
> XML**. Không sửa một dòng Java, không sửa code test, không đụng vào TestNG.
> Cái 'kiến trúc module hoá, cấu hình linh hoạt' các bạn vừa nghe — cụ thể nó
> là như vậy."

> "Phần của em là bài toán **tính tiền**: đúng giá, đúng chiết khấu, đúng làm
> tròn — toàn bộ là tính toán trên một yêu cầu đơn lẻ."

> "Còn `CourtBookingService` là bài toán khác hẳn: **nhiều người cùng tranh một
> cái sân**. Ở đó **thứ tự thao tác** mới là cái quyết định. Em mời bạn [tên]."

**→ Còn dư ~40 giây làm đệm cho câu hỏi và phần chạy chậm.**

---

# 📋 CHECKLIST TRƯỚC KHI LÊN

- [ ] **Chạy `.\run-tests.ps1 1` một lần trước buổi** — để Maven tải sẵn thư
      viện. Không làm bước này, lúc demo có thể đứng chờ tải cả phút → **vỡ bài**
- [ ] Terminal đã `cd` vào `backend`, lệnh gõ sẵn, chỉ việc Enter
- [ ] Phóng to chữ terminal (Ctrl + `+`)
- [ ] Mở sẵn 3 tab: `PricingService.java`, `PricingServiceTest.java`,
      `ConsoleNarrator.java`
- [ ] Kiểm tra tiếng Việt không ra dấu `?`
- [ ] **Ảnh chụp màn hình kết quả để trong slide dự phòng** — phòng build hỏng
- [ ] Bấm giờ tập thử **ít nhất 2 lần**

---

# ❓ CÂU HỎI DỄ BỊ HỎI

| Câu hỏi | Trả lời ngắn |
|---|---|
| **"Sao không sửa 3 lỗi cho xanh hết?"** ⭐ chắc chắn bị hỏi | "Sửa được ạ, mỗi lỗi vài dòng. Nhưng mục tiêu là trình bày **năng lực của bộ test**. Sửa code thì test xanh, và em mất luôn bằng chứng là test **đã bắt được** 3 lỗi đó." |
| "Mock là gì, sao không dùng database thật?" | "Mock là đồ giả. Em bảo nó: ai hỏi luật giá cầu lông ngày thường thì trả về luật này. Dùng database thật thì test chậm, phụ thuộc mạng, dữ liệu đổi làm test lúc đạt lúc trượt → không ai tin nó nữa." |
| "Sao build báo đỏ FAILURE?" | "Có test trượt thì Maven trả mã lỗi khác 0 — đúng thiết kế. Thực tế chính cái này chặn code lỗi không cho đẩy lên." |
| "11 lượt nhưng 8 hàm?" | "`@DataProvider` 4 bộ dữ liệu nên 1 hàm chạy 4 lần." |
| "Tham số `minutes` khai báo mà không dùng?" | "Đúng ạ, nó chỉ là chú thích để người đọc dễ đối chiếu với cột thời gian." |
| "Chạy máy khác được không?" | "Được, không cần database, script tự tìm JDK 17." |
| "`@Listeners` với file XML khác gì nhau?" | "XML dùng khi chạy bằng Maven. `@Listeners` gắn vào class nên chạy đường nào cũng có. Em để cả hai; TestNG loại trùng theo tên class nên không in 2 lần — cái này em có thử." |

---

# ✂️ CÒN CẮT NHỮNG GÌ

Có sẵn trong đầu, nhưng **đừng chủ động kể** — chỉ dùng khi được hỏi:

| Nội dung | Ghi chú |
|---|---|
| Sự cố VS Code không đọc file XML → phải thêm `@Listeners` | **Vũ khí dự phòng số 1.** Nếu bị hỏi "nhóm gặp khó khăn gì nữa" thì kể ngay |
| Test ưu tiên bảng giá riêng sân VIP (200k đè 140k) | Nếu bị hỏi "còn test gì nữa" |
| Bảng liệt kê đủ 7 file đã thêm | Liệt kê file không thuyết phục bằng chạy thật |
| Chi tiết 2 kiểu kiểm tra `Assert` vs `verify` | **Để dành cho người 2** — bạn ấy dùng `verify` nhiều hơn |
| Cơ chế `@Parameters` truyền dữ liệu từ XML | Dự án không dùng, nói ra dễ bị hỏi ngược |

> ⚠️ **Nếu lỡ giờ:** phần cắt được đầu tiên là **sự cố UTF-8** (3:15–4:00), sau
> đó là **bảng ánh xạ kiến trúc** (2:35–3:15). Tuyệt đối không cắt phần 3 lỗi.
