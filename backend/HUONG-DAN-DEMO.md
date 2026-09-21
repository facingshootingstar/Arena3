# Hướng dẫn demo kiểm thử TestNG — Arena3 Backend

Tài liệu dành cho buổi thuyết trình hai người. Phần A là nền tảng chung, cả hai
cùng nắm. Phần B và C chia cho từng người, chạy độc lập, sinh báo cáo riêng.

---

## 0. Chạy nhanh

Mở terminal trong thư mục `backend/`:

```powershell
.\run-tests.ps1 1      # Người 1 — tính giá & chiết khấu   (8 lượt, 8 đạt)
.\run-tests.ps1 2      # Người 2 — giữ chỗ & trùng lịch    (6 lượt, 5 đạt, 1 trượt)
.\run-tests.ps1        # cả hai, kiểm tra trước buổi nói   (14 lượt, 13 đạt, 1 trượt)
```

Module 2 **cố ý có một test trượt**, và nó trượt vì phát hiện một lỗi thật trong
code. Xem mục C4 — đây là phần đáng giá nhất của bài.

---

# PHẦN A — NỀN TẢNG CHUNG

## A1. Code đang được kiểm thử

Hệ thống quản lý trung tâm thể thao, viết bằng Spring Boot. Hai lớp nghiệp vụ
được đem ra kiểm thử:

| Lớp | Phương thức chính | Nhiệm vụ |
|---|---|---|
| `PricingService` | `lookupPrice`, `memberDiscount`, `applyDiscount` | Tính giá sân theo khung giờ, áp chiết khấu hội viên |
| `CourtBookingService` | `holdBooking`, `cancelBooking` | Giữ chỗ sân, chống trùng lịch, huỷ đặt |

Điểm kỹ thuật quan trọng: cả hai lớp đều nhận phụ thuộc qua **constructor**.

```java
public CourtBookingService(CourtRepository courtRepository,
                           OccupancyRepository occupancyRepository,
                           CourtBookingRepository courtBookingRepository,
                           PricingService pricingService, ...) {
    this.courtRepository = courtRepository;
    ...
}
```

Đây gọi là **Dependency Injection qua constructor**. Nhờ nó, lúc test ta truyền
vào *đồ giả* thay cho repository thật, nên **không cần database** để chạy test.
Nếu service tự `new` repository bên trong thì không thể thay thế được, và toàn bộ
bài kiểm thử này sẽ phải dựng Postgres mới chạy nổi.

## A2. Không có TestNG thì khác gì?

Không có framework kiểm thử, muốn xác minh logic ta chỉ có hai cách:

1. **Bấm tay trên giao diện** — chậm, không lặp lại được, người khác không kiểm
   chứng được, và không ai nhớ đã thử những trường hợp nào.
2. **Viết một hàm `main()` rồi `System.out.println`** — chạy được, nhưng *người*
   phải tự đọc kết quả và tự quyết định đúng/sai. Máy không biết test trượt.

TestNG giải quyết đúng những chỗ đó:

| Vấn đề | Cách TestNG xử lý |
|---|---|
| Máy không tự biết đúng/sai | `Assert.assertEquals(...)` — sai thì test trượt, build đỏ |
| Test này làm bẩn dữ liệu test kia | `@BeforeMethod` dựng lại đồ giả mới trước **từng** test |
| Muốn chạy 1 logic với nhiều bộ dữ liệu | `@DataProvider` — 1 hàm, 4 bộ dữ liệu, 4 lượt chạy |
| Kiểm tra code có ném lỗi đúng không | `@Test(expectedExceptions = ...)` |
| Muốn chia test cho nhiều người chạy riêng | File suite XML + Maven profile |
| Cần báo cáo nộp thầy | Surefire tự sinh HTML/XML trong `target/surefire-reports/` |

Một điểm riêng của TestNG mà JUnit không có: **khai báo suite bằng file XML**.
Nhờ vậy ta chia bài cho hai người mà **không phải sửa một dòng code Java nào**.

## A3. Những gì đã thêm vào dự án

| File | Vai trò | Ghi chú |
|---|---|---|
| `pom.xml` | Khai báo thư viện `testng`, cấu hình plugin `surefire`, khai báo 2 profile | Thêm mới phần profile |
| `src/test/java/.../PricingServiceTest.java` | 5 hàm test module 1 | Có sẵn từ đầu |
| `src/test/java/.../CourtBookingServiceTest.java` | 6 hàm test module 2 | Thêm 1 test mới (mục C4) |
| `src/test/java/.../testsupport/ConsoleNarrator.java` | In tường thuật ra màn hình | **Thêm mới** |
| `src/test/resources/testng.xml` | Suite chạy cả hai module | Có sẵn |
| `src/test/resources/testng-module1-pricing.xml` | Suite riêng người 1 | **Thêm mới** |
| `src/test/resources/testng-module2-booking.xml` | Suite riêng người 2 | **Thêm mới** |
| `run-tests.ps1` | Script chạy, xử lý JDK + mã hoá tiếng Việt | **Thêm mới** |

### File nào là file "chạy"?

File bạn gõ lệnh là **`run-tests.ps1`**. Nhưng nó chỉ là mắt xích đầu. Chuỗi thực
thi đầy đủ:

```
run-tests.ps1                    ← bạn chạy file này
   │  đặt JAVA_HOME, bật UTF-8, chọn profile
   ▼
mvnw.cmd                         ← Maven Wrapper (tự tải Maven nếu chưa có)
   │
   ▼
pom.xml                          ← profile module1/module2 quyết định dùng suite nào
   │  testng.suiteXmlFile = src/test/resources/testng-module2-booking.xml
   ▼
maven-surefire-plugin            ← plugin chạy test, sinh báo cáo
   │
   ▼
testng-module2-booking.xml       ← liệt kê class nào được chạy + đăng ký listener
   │
   ▼
CourtBookingServiceTest.java     ← code test thật sự chạy ở đây
```

Trình bày với thầy nên đi ngược chuỗi này: bắt đầu từ file test, rồi giải thích
dần ra ngoài tới lệnh chạy.

## A4. Vì sao annotation nằm một nơi, suite XML một nơi, script một nơi?

Ba tầng này thay đổi vì ba lý do khác nhau, nên tách ra:

**Tầng 1 — Code test (`*Test.java`): kiểm tra CÁI GÌ**

```java
@Listeners(ConsoleNarrator.class)
public class CourtBookingServiceTest {

    @Test(description = "Giữ chỗ sân thành công khi khung giờ còn trống")
    public void testHoldBookingSuccess() { ... }
}
```

Annotation phải nằm sát code mà nó mô tả. `description` viết bằng tiếng Việt vì
nó chính là dòng chữ hiện ra lúc chạy. Tầng này đổi khi **quy tắc nghiệp vụ đổi**.

**Tầng 2 — Suite XML (`testng-*.xml`): chạy NHỮNG TEST NÀO cùng nhau**

```xml
<suite name="Arena3-Module2-Booking" verbose="1">
    <listeners>
        <listener class-name="com.arena3.testsupport.ConsoleNarrator" />
    </listeners>
    <test name="Court-Booking-And-Overlap-Rules">
        <classes>
            <class name="com.arena3.service.CourtBookingServiceTest" />
        </classes>
    </test>
</suite>
```

Muốn đổi cách nhóm test, sửa file XML là xong — **không cần biên dịch lại Java**.
Tầng này đổi khi **cách tổ chức buổi demo đổi**.

**Tầng 3 — Script (`run-tests.ps1`): chạy NHƯ THẾ NÀO trên máy này**

```powershell
chcp 65001 | Out-Null                        # console hiểu UTF-8
$env:JAVA_HOME = <đường dẫn JDK 17>
$env:MAVEN_OPTS = '-Dfile.encoding=UTF-8 -Dsun.stdout.encoding=UTF-8 ...'
& .\mvnw.cmd -o -Pmodule2-booking test
```

Tầng này chẳng liên quan gì tới nghiệp vụ — nó chỉ lo chuyện **máy Windows**:
JDK nào, bảng mã nào. Đổi khi **đổi máy hoặc đổi hệ điều hành**.

### Vì sao `ConsoleNarrator` được đăng ký ở **cả hai** tầng 1 và tầng 2?

Đây là chi tiết đáng kể, phát hiện trong lúc làm:

- Đăng ký trong **XML** → chạy bằng `mvn test` thì có tường thuật.
- Nhưng bấm nút ▶ trong tab **Testing** của VS Code thì **không** có, vì extension
  "Test Runner for Java" dùng bộ chạy TestNG riêng, **không đọc file XML**.
- Thêm `@Listeners(ConsoleNarrator.class)` ngay trên class thì TestNG nạp listener
  bất kể được khởi chạy theo đường nào.

Đăng ký hai nơi **không bị in trùng**, vì TestNG loại trùng theo tên class listener.

## A5. Các thành phần TestNG dùng trong bài

| Thành phần | Dùng ở đâu | Tác dụng |
|---|---|---|
| `@Test` | 11 phương thức | Đánh dấu đây là một test |
| `description` | mọi `@Test` | Câu mô tả tiếng Việt, hiện lúc chạy và trong báo cáo |
| `@BeforeMethod` | `setUp()` | Dựng lại mock mới trước **từng** test → các test độc lập |
| `@DataProvider` | `timePriceProvider` | 1 hàm × 4 bộ dữ liệu = 4 lượt chạy |
| `expectedExceptions` | 2 test module 2 | Khai báo "test này *phải* ném lỗi" |
| `@Listeners` + `ITestListener` | `ConsoleNarrator` | Móc vào vòng đời để in tường thuật |
| Suite XML | 3 file `testng*.xml` | Chia nhóm test, đăng ký listener |
| Maven profile | `pom.xml` | Chọn suite nào được chạy |

### Mockito — đồ giả thay cho database

```java
courtRepository = Mockito.mock(CourtRepository.class);
when(courtRepository.findById(courtId)).thenReturn(Optional.of(court));
```

Dịch ra tiếng Việt: *"tạo một CourtRepository giả; khi ai đó gọi `findById` với id
này, trả về cái sân tôi vừa dựng sẵn"*. Nhờ vậy test chạy xong trong ~2 giây và
chạy được ở mọi máy, không cần cài Postgres.

### Hai kiểu kiểm tra — điểm dễ được hỏi

```java
Assert.assertEquals(savedBooking.getStatus(), "hold");        // kiểm tra TRẠNG THÁI
verify(occupancyRepository, times(1)).deleteById(oldOccId);   // kiểm tra HÀNH VI
```

- `Assert` kiểm tra **kết quả trả về** có đúng không.
- `verify` kiểm tra **service có gọi đúng thao tác, đúng số lần** không.

Cái thứ hai bắt được lỗi mà `Assert` bỏ sót — ví dụ xoá cùng một occupancy hai
lần: trạng thái cuối vẫn đúng, nhưng hành vi thì sai.

### Đọc con số tổng kết

```
Tổng lượt chạy: 8   Đạt: 8   Thất bại: 0   Bỏ qua: 0
```

Module 1 chỉ có **5 phương thức** `@Test` nhưng báo **8 lượt chạy**. Không mâu
thuẫn: `testLookupPriceDynamic` dùng `@DataProvider` nên chạy 4 lần với 4 bộ dữ
liệu. TestNG đếm theo **lượt chạy thực tế**, không đếm theo số hàm.

---

# PHẦN B — NGƯỜI THUYẾT TRÌNH 1

## Module 1: Tính giá sân và chiết khấu hội viên

```powershell
.\run-tests.ps1 1
```

Kết quả: **8 lượt chạy, 8 đạt, 0 trượt.**

### B1. Bốn lượt kiểm tra bảng giá theo khung giờ

Một hàm `testLookupPriceDynamic`, chạy 4 lần nhờ `@DataProvider`:

| Lượt | Thời điểm | Loại ngày | Giá kỳ vọng | Cao điểm? |
|---|---|---|---|---|
| 1 | Thứ 4, 09:00 | ngày thường | 80.000đ | Không |
| 2 | Thứ 4, 18:00 | ngày thường | 140.000đ | Có |
| 3 | Chủ nhật, 07:00 | cuối tuần | 80.000đ | Không |
| 4 | Chủ nhật, 10:00 | cuối tuần | 140.000đ | Có |

Quy tắc rút ra: giá phụ thuộc **cả hai** yếu tố — ngày thường hay cuối tuần, và
giờ cao điểm hay thấp điểm. Cuối tuần vào giờ cao điểm sớm hơn ngày thường
(từ 08:00 thay vì 18:00), nên 10:00 sáng chủ nhật đã tính giá cao.

> Lưu ý nếu thầy hỏi: tham số `minutes` (540, 1080, 420, 600 — số phút tính từ
> 0 giờ) khai báo trong `@DataProvider` nhưng không dùng trong thân hàm, nó chỉ
> đóng vai trò chú thích cho người đọc dễ đối chiếu với cột thời gian.

### B2. Ưu tiên bảng giá riêng của sân

`testCourtSpecificPriceRulePriority`

Dựng hai luật giá cùng lúc: luật chung toàn môn cầu lông **140.000đ**, và luật
riêng cho sân VIP **200.000đ**. Kỳ vọng hệ thống chọn **200.000đ**.

Ý nghĩa: luật cụ thể phải đè lên luật tổng quát. Nếu chọn sai, sân VIP bị bán
bằng giá sân thường — trung tâm mất tiền mà không ai phát hiện.

### B3. Chiết khấu hội viên — cặp thuận và nghịch

| Test | Tình huống | Kỳ vọng |
|---|---|---|
| `testMemberDiscountActiveSubscription` | Gói **cầu lông** còn hạn, giảm 20%, còn 10 giờ | Giảm **20%** |
| `testMemberDiscountDifferentSport` | Gói **bóng rổ**, nhưng đang đặt sân **cầu lông** | Giảm **0%** |

Đây là cặp test quan trọng nhất về mặt phương pháp: một cái chứng minh tính năng
**chạy đúng khi được phép**, một cái chứng minh nó **không chạy khi không được
phép**. Chỉ có test thứ nhất thì một lỗi "giảm giá cho mọi môn" sẽ lọt lưới.

### B4. Công thức tính tiền cuối

`testApplyDiscountRounding`

```
140.000đ giảm 15%  →  140.000 × 0,85 = 119.000đ   (làm tròn bội số 1.000đ)
140.000đ giảm  0%  →  140.000đ                     (giữ nguyên)
```

Kiểm tra cả phép nhân lẫn phép làm tròn, và cả trường hợp biên 0% — vì lỗi chia
cho 0 hoặc làm tròn sai thường nấp ở đúng trường hợp biên này.

---

# PHẦN C — NGƯỜI THUYẾT TRÌNH 2

## Module 2: Giữ chỗ sân và chống trùng lịch

```powershell
.\run-tests.ps1 2
```

Kết quả: **6 lượt chạy, 5 đạt, 1 trượt.** Test trượt là phần hay nhất, để dành
nói cuối.

### C1. Giữ chỗ thành công

`testHoldBookingSuccess`

Sân trạng thái `ready`, khung giờ trống. Kỳ vọng:
- Tạo booking trạng thái `hold`, giá 140.000đ, đánh dấu giờ cao điểm
- **Ghi đúng một** bản ghi chiếm dụng loại `hold`

```java
verify(occupancyRepository, times(1)).save(argThat(occ ->
        "hold".equals(occ.getKind()) && occ.getCourtId().equals(courtId)
));
```

`times(1)` quan trọng: ghi hai bản ghi chiếm dụng sẽ làm sân bị khoá vĩnh viễn.

### C2. Chống trùng lịch

`testHoldBookingOverlapConflict`

Giả lập khung giờ đã có người chiếm. Kỳ vọng ném `ApiException` với mã
`CONFLICT_SLOT` và HTTP **409 Conflict**.

```java
@Test(expectedExceptions = ApiException.class, description = "...")
public void testHoldBookingOverlapConflict() {
    try {
        courtBookingService.holdBooking(body, null);
    } catch (ApiException ex) {
        Assert.assertEquals(ex.getCode(), "CONFLICT_SLOT");
        Assert.assertEquals(ex.getStatus(), 409);
        throw ex;    // ném lại để expectedExceptions bắt được
    }
}
```

Mẫu này đáng giải thích: `expectedExceptions` bảo đảm **có** ném lỗi, còn khối
`catch` bảo đảm ném **đúng loại lỗi**. Chỉ dùng `expectedExceptions` thì một lỗi
sai hoàn toàn nhưng cùng class vẫn được coi là đạt.

### C3. Hai quy tắc còn lại

| Test | Tình huống | Kỳ vọng |
|---|---|---|
| `testHoldBookingCourtInMaintenance` | Sân đang `maintenance` | Ném lỗi vi phạm **BR-12** |
| `testCancelBookingSuccess` | Huỷ lượt đang `hold` | `success = true`, trạng thái `cancelled`, `occupancyId` về null, occupancy bị xoá |
| `testHoldBookingReplacesOldHold` | Khách đã giữ sân A, nay giữ sân B (B trống) | Lượt cũ chuyển `cancelled`, giải phóng đúng 1 lần |

`testHoldBookingReplacesOldHold` thể hiện quy tắc **chống chiếm dụng sân**: một
người không được giữ nhiều sân cùng lúc để "xí chỗ".

### C4. Test trượt — và vì sao nó trượt

`testFailedHoldMustNotReleaseExistingHold` — **FAIL**

```
-> Giữ chỗ thất bại thì không được làm mất lượt giữ chỗ cũ của khách
   FAIL  (13 ms): Yêu cầu giữ chỗ mới thất bại nhưng lượt giữ chỗ cũ đã bị huỷ mất
                  expected [hold] but found [cancelled]
```

**Tình huống:** khách đang giữ sân A. Khách bấm giữ sân B, nhưng sân B vừa có
người khác đặt mất.

**Kỳ vọng đúng:** báo lỗi "sân B đã có người", và khách **vẫn còn sân A**.

**Thực tế:** khách bị **mất luôn sân A** mà cũng **không có sân B**.

**Nguyên nhân — thứ tự xử lý trong `CourtBookingService.holdBooking()` bị ngược:**

```java
// Dòng 99-110: HUỶ lượt giữ chỗ cũ của khách      ← làm TRƯỚC
if (user != null) {
    List<CourtBookingEntity> oldHolds = courtBookingRepository.findByUserIdAndStatus(...);
    for (CourtBookingEntity h : oldHolds) {
        occupancyRepository.deleteById(h.getOccupancyId());
        h.setStatus("cancelled");
    }
}

// Dòng 113-116: KIỂM TRA khung giờ có trùng không  ← làm SAU
List<OccupancyEntity> overlaps = occupancyRepository.findOverlapping(courtId, startAt, endAt);
if (!overlaps.isEmpty()) {
    throw ApiException.conflictSlot("Khung giờ đã có người đặt hoặc trùng lịch.");
}
```

Code huỷ sân cũ **trước khi** biết sân mới có đặt được hay không. Đến lúc phát
hiện trùng lịch và ném lỗi thì sân cũ đã bị xoá mất rồi.

**Cách sửa:** đảo thứ tự — kiểm tra trùng lịch trước, chỉ huỷ lượt cũ sau khi đã
chắc chắn sân mới đặt được.

### C5. Vì sao có một test trượt lại là điều tốt

Đây là ý nên chốt bài:

1. **Lỗi này vô hình với kiểm thử thủ công.** Bấm tay trên giao diện, ai cũng chỉ
   thử đường đi thuận lợi — giữ một sân đang trống. Rất ít người nghĩ tới việc
   "đang giữ sân A thì thử giữ sân B đã có người".

2. **Bốn test kia đều đạt vẫn không cứu được.** `testHoldBookingReplacesOldHold`
   có kiểm tra việc huỷ lượt giữ chỗ cũ, nhưng chỉ ở tình huống **thành công**.
   Lỗi nằm đúng ở tình huống **thất bại** — chỗ chưa ai kiểm tra.

3. **Test trượt đúng chỗ cần trượt.** Thông báo chỉ thẳng ra trạng thái sai
   (`expected [hold] but found [cancelled]`) và chỉ đúng dòng code gây ra.

4. **Một bộ test mà mọi thứ đều xanh chưa chắc là tin tốt** — nhiều khi chỉ có
   nghĩa là ta chưa hỏi đủ khó. Giá trị của kiểm thử tự động nằm ở chỗ nó tìm ra
   lỗi *trước khi* người dùng gặp, chứ không phải ở con số 100% đạt.

---

## Phụ lục 1 — Báo cáo cho thầy

Mỗi lần chạy, Surefire sinh báo cáo riêng cho từng suite:

```
target/surefire-reports/Arena3-Module1-Pricing/Pricing-And-Discount-Rules.html
target/surefire-reports/Arena3-Module2-Booking/Court-Booking-And-Overlap-Rules.html
```

Mỗi người có thư mục báo cáo riêng, không ghi đè lên nhau, vì hai file suite XML
đặt `name` khác nhau.

## Phụ lục 2 — Sự cố hay gặp

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Chữ tiếng Việt thành `Ki?m tra c?ng th?c` | Console Windows ở code page 437, không có chữ Việt. JDK 17 khi ghi ra console thật sẽ mã hoá theo code page của console chứ không theo `file.encoding` | Chạy bằng `run-tests.ps1` (đã có `chcp 65001` + `-Dsun.stdout.encoding=UTF-8`) |
| Tab Testing của VS Code báo "did not report any output" | Extension dùng bộ chạy TestNG riêng, không đọc `testng.xml` | Dùng terminal với `run-tests.ps1`; tab Testing chỉ dùng để xem dấu tích xanh/đỏ |
| `mvn` báo lỗi phiên bản Java | Máy đang dùng JDK mặc định 1.8, Spring Boot 3.3.4 cần JDK 17 | `run-tests.ps1` tự tìm và đặt `JAVA_HOME` sang JDK 17 |
| `BUILD FAILURE` sau khi chạy module 2 | **Đúng như thiết kế** — có 1 test trượt (mục C4) | Không phải hỏng, đó là nội dung cần trình bày |
