# Kịch bản thuyết trình — Người 1 (Demo & Giới thiệu code)

> **Bối cảnh:** 3 bạn trước đã nói overview và giới thiệu TestNG ở mức lý thuyết.
> Nhiệm vụ của bạn: **kéo lý thuyết đó xuống code thật đang chạy**.
> Thời lượng thiết kế: **~15 phút**. Cách cắt còn 10 phút ở cuối file.

---

## PHẦN 0 — BA THÔNG ĐIỆP CHÍNH (keys)

Nếu khán giả chỉ nhớ được 3 câu, phải là 3 câu này:

> **KEY 1 — Test chạy không cần database.**
> Nhờ constructor injection + Mockito, cả bộ test chạy xong trong ~2 giây trên
> bất kỳ máy nào. Đây là lý do test **thực sự được chạy** chứ không nằm chết.

> **KEY 2 — Cùng một bộ test, chia được cho 2 người mà không sửa một dòng Java.**
> Chỉ thêm 2 file XML. Đây là "kiến trúc module hoá" mà các bạn trước vừa nói,
> nhìn thấy bằng mắt.

> **KEY 3 — Bộ test của em có 3 test TRƯỢT, và đó là phần giá trị nhất.**
> Cả 3 đều phát hiện lỗi thật trong code tính tiền. Không bấm tay nào tìm ra được.

**Câu chốt cả bài** (học thuộc câu này):

> *"Một bộ test toàn màu xanh không chứng minh code đúng — nhiều khi nó chỉ
> chứng minh mình chưa hỏi đủ khó."*

---

## PHẦN 0b — NHỮNG GÌ **KHÔNG** ĐƯỢC NÓI LẠI

3 bạn trước đã dùng hết rồi, nói lại là mất điểm vì trùng lặp:

| Chủ đề | Xử lý |
|---|---|
| TestNG là gì, lịch sử, so với JUnit | ❌ Bỏ hẳn |
| Danh sách annotation `@Test`, `@BeforeMethod`… | ❌ Không đọc lại danh sách. Chỉ chỉ vào code khi nó xuất hiện |
| Ưu điểm chung của kiểm thử tự động | ❌ Bỏ |
| 5 thành phần kiến trúc TestNG | ⚠️ **Không giảng lại**, chỉ nói *"cái các bạn vừa nghe nằm ở đây trong dự án của em"* + chiếu bảng ánh xạ |

**Câu mở đầu để bắc cầu** (nói nguyên văn):

> *"Ba bạn vừa rồi đã trình bày TestNG về mặt lý thuyết. Phần của em ngược lại:
> em sẽ mở code thật của hệ thống Arena3, chỉ ra từng thứ vừa nghe nó nằm ở
> dòng nào, rồi chạy trực tiếp cho cả lớp xem kết quả — kể cả những test trượt."*

---

# KỊCH BẢN CHI TIẾT

## ⏱ 0:00 – 1:30 | Phần 1: Hệ thống đang được kiểm thử là gì

**Chiếu:** cây thư mục `backend/src/main/java/com/arena3/service/`

**Nói:**

> "Arena3 là hệ thống quản lý trung tâm thể thao — đặt sân cầu lông, bóng rổ.
> Em không test toàn bộ hệ thống, em chọn **2 lớp nghiệp vụ khó nhất**, tức là
> 2 chỗ mà nếu sai thì mất tiền thật:"

| Lớp | Nếu sai thì sao |
|---|---|
| `PricingService` | Tính sai giá → thu sai tiền khách |
| `CourtBookingService` | Giữ chỗ sai → 2 khách cùng 1 sân, 1 giờ |

> "Em phụ trách `PricingService`. Bạn thứ hai phụ trách `CourtBookingService`."

**Chiếu tiếp:** constructor của `PricingService`

```java
public PricingService(PriceRuleRepository priceRuleRepository,
                      SubscriptionRepository subscriptionRepository,
                      MembershipPlanRepository membershipPlanRepository) {
```

**Nói — đây là KEY 1, nói chậm:**

> "Chỗ này quyết định cả bài. Service **không tự tạo** repository bên trong, mà
> **nhận từ bên ngoài qua constructor**. Nhờ vậy lúc test em truyền vào đồ giả
> thay cho database thật."

> "Hệ quả: **toàn bộ bộ test chạy không cần cài Postgres**, xong trong khoảng 2
> giây, chạy được trên máy bất kỳ ai. Nếu service tự `new` repository ở trong
> thì không thay được, và muốn chạy test thì phải dựng nguyên một database."

🎯 *Đây là chỗ ghi điểm — nó cho thấy bạn hiểu **vì sao** code được viết như vậy,
chứ không chỉ biết gõ `@Test`.*

---

## ⏱ 1:30 – 3:30 | Phần 2: Nhóm đã thêm những gì vào dự án

**Chiếu:** bảng này

| File | Vai trò |
|---|---|
| `PricingServiceTest.java` | 8 hàm test — phần của em |
| `CourtBookingServiceTest.java` | 5 hàm test — phần bạn 2 |
| `testsupport/ConsoleNarrator.java` | **Tự viết** — in tường thuật ra màn hình |
| `testng-module1-pricing.xml` | Suite riêng của em |
| `testng-module2-booking.xml` | Suite riêng của bạn 2 |
| `run-tests.ps1` | Script chạy |
| `pom.xml` | Khai báo thư viện + 2 Maven profile |

**Câu hỏi tự đặt ra rồi tự trả lời** (kỹ thuật này làm bài nói có nhịp):

> "Vậy file nào là file mình 'chạy'? — Câu trả lời là **không có file nào chạy
> một mình cả**. Nó là một chuỗi."

**Chiếu sơ đồ:**

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

**Nói:**

> "Em sẽ đi **ngược** chuỗi này khi demo: bắt đầu từ file test ở dưới cùng, rồi
> giải thích dần ra tới lệnh chạy ở trên cùng."

### Chốt phần 2 bằng KEY 2

> "Và đây là điểm em muốn nhấn: để chia bài cho 2 người chạy riêng, nhóm em
> **chỉ thêm 2 file XML**. Không sửa một dòng Java nào, không sửa code test,
> không đụng vào TestNG. Cái 'kiến trúc module hoá, cấu hình linh hoạt' mà các
> bạn vừa nghe — nó cụ thể là như vậy."

---

## ⏱ 3:30 – 5:30 | Phần 3: Lý thuyết vừa nghe nằm ở đâu trong code

**Nói trước khi chiếu** (tránh giảng lại):

> "Em không nhắc lại 5 thành phần kiến trúc, các bạn vừa nghe rồi. Em chỉ chỉ ra
> **mỗi thành phần đó nằm ở file nào trong dự án em**."

**Chiếu bảng:**

| Thành phần (vừa nghe) | Nằm ở đâu trong Arena3 |
|---|---|
| TestNG Engine | `maven-surefire-plugin` khởi động qua `surefire-testng` |
| XML Configuration | 3 file `testng*.xml` |
| Annotation Processor | Đọc `@Test`, `@BeforeMethod`, `@DataProvider` trong 2 class test |
| Data Provider | `timePriceProvider` — 4 bộ dữ liệu |
| Listener & Reporter | **`ConsoleNarrator` nhóm em tự viết** + báo cáo Surefire |

**Dừng lại ở dòng cuối — đây là phần đáng khoe nhất:**

**Chiếu:** `ConsoleNarrator.java`

```java
public class ConsoleNarrator implements ITestListener {
    @Override public void onTestStart(ITestResult result)    { ... }
    @Override public void onTestSuccess(ITestResult result)  { ... }
    @Override public void onTestFailure(ITestResult result)  { ... }
    @Override public void onFinish(ITestContext context)     { ... }
}
```

**Nói:**

> "Cái dòng chữ tiếng Việt mà lát nữa các bạn thấy chạy trên màn hình — nó
> không phải của TestNG. Nó là **class nhóm em tự viết**, chỉ cần `implements
> ITestListener`, rồi TestNG tự gọi đúng hàm vào đúng thời điểm."

> "Nhóm em **không sửa TestNG**. Em cắm thêm một mảnh vào chỗ nó chừa sẵn. Đó
> mới là ý nghĩa thật của chữ *mở rộng được*."

### Một chi tiết nên kể (gây ấn tượng "có làm thật")

> "Chỗ này nhóm em có vấp một lần. Ban đầu em chỉ đăng ký `ConsoleNarrator`
> trong file XML. Chạy bằng dòng lệnh thì ra chữ, nhưng bấm nút chạy trong VS
> Code thì **không ra gì**. Tìm ra nguyên nhân: extension của VS Code dùng bộ
> chạy TestNG riêng, **nó không đọc file XML của mình**."

> "Cách xử lý: thêm `@Listeners(ConsoleNarrator.class)` ngay trên class test, để
> listener được nạp dù khởi chạy bằng đường nào. Đăng ký ở cả hai nơi **không bị
> in trùng**, vì TestNG loại trùng theo tên class listener — cái này em có thử
> để xác nhận."

---

## ⏱ 5:30 – 8:00 | Phần 4: CHẠY DEMO 🔴

**Gõ lệnh** (đã mở sẵn terminal ở thư mục `backend`):

```powershell
.\run-tests.ps1 1
```

**Trong lúc chờ build, nói về script:**

> "Script này làm 3 việc trước khi gọi Maven: tìm JDK 17, bật UTF-8 cho console,
> và chọn profile module 1."

> "Chuyện UTF-8 nghe nhỏ nhưng nhóm em mất thời gian nhất ở đây. Console Windows
> mặc định ở code page 437, **không có chữ tiếng Việt**. Lúc đầu chạy ra
> `Ki?m tra c?ng th?c` — dấu hỏi hết. Nguyên nhân: JDK 17 khi in ra console thật
> thì mã hoá theo code page của console, **không theo `file.encoding`** như mình
> tưởng. Phải sửa **cả hai phía**: `chcp 65001` cho console và
> `-Dsun.stdout.encoding=UTF-8` cho JVM."

🎯 *Đoạn này rất đáng kể vì nó chứng minh nhóm tự debug, không copy hướng dẫn.*

**Khi kết quả hiện ra, chỉ vào dòng tổng kết:**

```
Tổng lượt chạy: 11   Đạt: 8   Thất bại: 3   Bỏ qua: 0
```

**Đặt bẫy có chủ ý** (khán giả sẽ thắc mắc, mình trả lời trước):

> "Các bạn để ý: em chỉ viết **8 hàm** `@Test`, nhưng ở đây báo **11 lượt chạy**.
> Không phải lỗi. Có một hàm dùng `@DataProvider` với 4 bộ dữ liệu, nên nó chạy
> 4 lần. TestNG đếm theo **lượt chạy thực tế**, không đếm theo số hàm."

---

## ⏱ 8:00 – 9:30 | Phần 5: 8 test ĐẠT nói lên điều gì

Đừng đọc lần lượt 8 test — chán và hết giờ. **Gom thành 3 nhóm:**

**Nhóm 1 — Bảng giá theo khung giờ (4 lượt, dùng `@DataProvider`)**

| Thời điểm | Giá | Cao điểm? |
|---|---|---|
| Thứ 4, 09:00 | 80.000đ | Không |
| Thứ 4, 18:00 | 140.000đ | Có |
| Chủ nhật, 07:00 | 80.000đ | Không |
| Chủ nhật, 10:00 | 140.000đ | **Có** |

> "Dòng cuối là chỗ dễ sai: 10 giờ sáng ngày thường thì rẻ, nhưng 10 giờ sáng
> **chủ nhật** đã là giá cao điểm, vì cuối tuần giờ cao điểm bắt đầu từ 8 giờ."

> "Muốn thêm ca kiểm thử 'thứ 7 lúc 10 giờ đêm' thì em **thêm một dòng dữ liệu**,
> không viết thêm hàm test nào."

**Nhóm 2 — Ưu tiên bảng giá riêng của sân**

> "Sân VIP có bảng giá riêng 200.000đ, đè lên bảng giá chung 140.000đ. Nếu chọn
> sai, sân VIP bị bán bằng giá sân thường — mất tiền mà không ai biết."

**Nhóm 3 — Cặp test thuận/nghịch của chiết khấu hội viên** ⭐

| Test | Tình huống | Kỳ vọng |
|---|---|---|
| `testMemberDiscountActiveSubscription` | Gói **cầu lông**, còn hạn | Giảm **20%** |
| `testMemberDiscountDifferentSport` | Gói **bóng rổ**, đặt sân **cầu lông** | Giảm **0%** |

**Nói (đây là ý về phương pháp, giám khảo hay chấm chỗ này):**

> "Cặp này em cố ý viết thành đôi. Một test chứng minh tính năng **chạy đúng khi
> được phép**, một test chứng minh nó **không chạy khi không được phép**. Nếu chỉ
> có test thứ nhất, thì lỗi 'giảm giá cho mọi môn' sẽ lọt hoàn toàn."

---

## ⏱ 9:30 – 13:30 | Phần 6: BA TEST TRƯỢT ⭐ ĐIỂM NHẤN CẢ BÀI

**Câu mở — nói dứt khoát, đừng xin lỗi:**

> "Bây giờ tới phần em muốn nói nhất. Bộ test của em **trượt 3 cái**. Em không
> sửa cho nó xanh, và em sẽ giải thích tại sao."

> "Cả 3 đều trượt vì **code có lỗi thật**, không phải vì em viết sai kỳ vọng.
> Và cố ý là **3 loại lỗi khác nhau**."

### Lỗi 1 — Quên đọc một trường dữ liệu

```
FAIL: Gói tập phải tới ngày 2026-10-01 mới có hiệu lực, chưa được giảm giá hôm nay
      expected [0] but found [20]
```

> "Khách mua trước gói tập, 10 ngày nữa mới bắt đầu. Hôm nay đặt sân đã được
> giảm 20% rồi."

**Chiếu code:**

```java
if (!s.getEndOn().isBefore(today)) {     // chỉ kiểm tra ngày KẾT THÚC
```

> "Trường `startOn` **có trong dữ liệu nhưng không hề được dùng**. Nên gói nào
> cũng bị coi như đã bắt đầu. Sửa: thêm điều kiện kiểm tra `startOn`."

### Lỗi 2 — Quên chặn giá trị biên

```
FAIL: Giảm 150% cho ra giá -70000đ - trung tâm phải trả tiền cho khách
```

> "Admin nhập nhầm 150 thay vì 15. Giá sân 140.000đ thành **âm 70.000đ**."

**Chiếu code:**

```java
if (pct <= 0) return list;    // có chặn cận DƯỚI
                              // nhưng không chặn cận TRÊN
```

> "Code có chặn phần trăm âm, nhưng quên chặn trần. Đây là kiểu lỗi kinh điển:
> nghĩ tới một đầu mà quên đầu kia."

### Lỗi 3 — Sai hướng làm tròn ⭐ (kể cái này kỹ nhất)

```
FAIL: Khách phải trả 122000đ trong khi giá sau chiết khấu chỉ là 121.800đ
```

**Viết lên bảng / chiếu to:**

```
Giá sân:               140.000đ
Giảm 13%:              140.000 × 0,87 = 121.800đ
Hệ thống thu:                            122.000đ
                                       ──────────
Khách trả dư:                                200đ
```

> "Nguyên nhân là `Math.round` — nó làm tròn về số **gần nhất**, nên 121,8 nghìn
> thành 122 nghìn, tức là **làm tròn lên**."

> "200 đồng nghe rất nhỏ. Nhưng thứ nhất, nhân với hàng nghìn lượt đặt sân thì
> thành tiền thật. Thứ hai, và quan trọng hơn: đây là **thu sai so với giá trung
> tâm đã công bố**. Cách sửa là dùng `Math.floor` — làm tròn xuống, nghiêng về
> phía có lợi cho khách."

### 🎤 CHỐT — học thuộc đoạn này

> "Em muốn nói 3 ý về 3 cái lỗi này:"

> "**Thứ nhất**, cả 3 đều **vô hình với kiểm thử thủ công**. Bấm tay trên giao
> diện thì ai cũng chỉ thử trường hợp bình thường: gói đang còn hạn, giảm 15%,
> giá tròn số. Không ai nghĩ tới gói *chưa bắt đầu*, hay tới việc gõ nhầm *150%*."

> "**Thứ hai**, và đây mới đáng sợ — **8 test đạt kia không cứu được**. Em đã có
> sẵn test kiểm tra chiết khấu, và có sẵn test kiểm tra làm tròn. Nhưng cả hai
> chỉ thử **trường hợp đẹp**. Lỗi nằm ở **trường hợp biên**, chỗ chưa ai hỏi tới."

> "**Thứ ba**, 3 lỗi thuộc 3 loại khác nhau: một cái **quên đọc dữ liệu**, một
> cái **quên chặn biên**, một cái **sai công thức làm tròn**."

> "Nên nếu bài của em toàn màu xanh, em nghĩ nó còn **kém tin cậy hơn** bây giờ.
> Một bộ test toàn xanh không chứng minh code đúng — nhiều khi nó chỉ chứng minh
> **mình chưa hỏi đủ khó**."

---

## ⏱ 13:30 – 14:00 | Phần 7: Chuyển cho người 2

> "Phần của em là bài toán **tính tiền**: đúng giá, đúng chiết khấu, đúng làm
> tròn. Toàn bộ là tính toán trên một yêu cầu đơn lẻ."

> "Còn `CourtBookingService` là bài toán khác hẳn: **nhiều người cùng tranh một
> cái sân**. Ở đó thứ tự thao tác mới là cái quyết định. Em mời bạn [tên]."

---

# PHỤ LỤC 1 — CÂU HỎI CÓ THỂ BỊ HỎI

| Câu hỏi | Trả lời |
|---|---|
| **"Sao không sửa 3 lỗi đi rồi test xanh hết?"** | "Sửa được ạ, cả 3 đều sửa trong vài dòng. Nhưng mục tiêu bài này là **trình bày năng lực của bộ test**. Nếu em sửa code thì test xanh, và em mất luôn bằng chứng rằng test **đã bắt được** 3 lỗi đó." |
| **"Mock là gì, sao không dùng database thật?"** | "Mock là đồ giả. Em bảo nó: *ai hỏi luật giá cầu lông ngày thường thì trả về luật này*. Dùng database thật thì test chạy chậm, phụ thuộc mạng, và dữ liệu thay đổi làm test lúc đạt lúc trượt — thành ra không ai tin nó nữa." |
| **"11 lượt chạy nhưng 8 hàm, sao lạ vậy?"** | "Một hàm dùng `@DataProvider` 4 bộ dữ liệu nên chạy 4 lần. TestNG đếm theo lượt chạy." |
| **"Tham số `minutes` khai báo mà không dùng?"** | "Đúng ạ, nó chỉ đóng vai trò chú thích để người đọc dễ đối chiếu với cột thời gian trong bảng dữ liệu." |
| **"Sao chia 2 module, để chung không được à?"** | "Được ạ, `.\run-tests.ps1` không tham số là chạy cả hai. Chia ra để mỗi người demo phần mình mà không phải chờ, và để báo cáo của 2 người nằm 2 thư mục riêng." |
| **"`@Listeners` với file XML khác gì nhau?"** | "XML dùng khi chạy bằng Maven. `@Listeners` gắn vào class nên chạy đường nào cũng có. Em để cả hai; TestNG loại trùng theo tên class nên không in 2 lần — cái này em có thử." |
| **"Test có chạy trên máy khác được không?"** | "Được ạ. Không cần database, `run-tests.ps1` tự tìm JDK 17. Máy nào có JDK 17 là chạy." |
| **"Sao build báo màu đỏ FAILURE?"** | "Vì có test trượt thì Maven trả mã lỗi khác 0 — đúng thiết kế. Trong thực tế chính cái này chặn không cho code lỗi được đẩy lên." |

---

# PHỤ LỤC 2 — CHECKLIST TRƯỚC KHI LÊN

- [ ] Mở sẵn terminal, `cd` vào thư mục `backend`
- [ ] **Chạy thử `.\run-tests.ps1 1` một lần trước** để Maven tải sẵn thư viện —
      lần demo thật sẽ nhanh hơn nhiều
- [ ] Phóng to chữ terminal (Ctrl + `+`) để cuối lớp đọc được
- [ ] Mở sẵn 3 tab file: `PricingServiceTest.java`, `PricingService.java`,
      `ConsoleNarrator.java`
- [ ] Kiểm tra chữ tiếng Việt hiện đúng, không ra dấu `?`
- [ ] Chuẩn bị sẵn câu trả lời cho câu **"sao không sửa cho xanh hết"** — kiểu
      gì cũng bị hỏi

⚠️ **Phòng khi máy chiếu hỏng / build lỗi:** chụp sẵn ảnh màn hình kết quả chạy,
để trong slide dự phòng cuối deck.

---

# PHỤ LỤC 3 — NẾU CHỈ CÓ 10 PHÚT

Cắt theo thứ tự này:

| Ưu tiên | Phần | Xử lý |
|---|---|---|
| Giữ bằng mọi giá | Phần 6 — 3 test trượt | **Không cắt** (4 phút) |
| Giữ | Phần 4 — chạy demo | Giữ, nhưng bỏ đoạn kể về UTF-8 (tiết kiệm 45s) |
| Rút gọn | Phần 5 — 8 test đạt | Chỉ nói **nhóm 3** (cặp thuận/nghịch), bỏ nhóm 1 và 2 |
| Rút gọn | Phần 2 — file đã thêm | Chiếu sơ đồ chuỗi chạy, không đọc bảng file |
| Cắt được | Phần 3 — bảng ánh xạ kiến trúc | Chỉ giữ đoạn `ConsoleNarrator` tự viết |
| Cắt được | Chi tiết lỗi VS Code | Để dành trả lời nếu được hỏi |

**Nguyên tắc:** thà nói kỹ 3 test trượt còn hơn kể lướt qua đủ 11 test.
