# Hướng dẫn demo kiểm thử TestNG — Arena3 Backend

Tài liệu cho buổi thuyết trình hai người.

- **Người 1** trình bày phần nền tảng chung (TestNG là gì, cấu trúc dự án, cách
  chạy) rồi demo **module 1 — tính giá**, trong đó có **3 test trượt**.
- **Người 2** chỉ trình bày **module 2 — giữ chỗ sân**, toàn bộ đều đạt.

---

## 0. Chạy nhanh

Mở terminal trong thư mục `backend/`:

```powershell
.\run-tests.ps1 1      # Người 1 — tính giá & chiết khấu   (11 lượt, 8 đạt, 3 TRƯỢT)
.\run-tests.ps1 2      # Người 2 — giữ chỗ & trùng lịch    (5 lượt, 5 đạt)
.\run-tests.ps1        # cả hai, kiểm tra trước buổi nói   (16 lượt, 13 đạt, 3 trượt)
```

Module 1 **cố ý có 3 test trượt** — cả ba đều phát hiện lỗi thật trong code, xem
mục A7. Vì vậy người 1 chạy xong sẽ thấy `BUILD FAILURE` màu đỏ; đó là đúng
thiết kế, không phải hỏng.

---

# PHẦN A — NGƯỜI THUYẾT TRÌNH 1

> Gồm phần nền tảng chung (A1–A5) và module 1 (A6–A7).

## A1. Code đang được kiểm thử

Hệ thống quản lý trung tâm thể thao, viết bằng Spring Boot. Hai lớp nghiệp vụ
được đem ra kiểm thử:

| Lớp | Phương thức chính | Nhiệm vụ |
|---|---|---|
| `PricingService` | `lookupPrice`, `memberDiscount`, `applyDiscount` | Tính giá sân theo khung giờ, áp chiết khấu hội viên |
| `CourtBookingService` | `holdBooking`, `cancelBooking` | Giữ chỗ sân, chống trùng lịch, huỷ đặt |

Điểm kỹ thuật quan trọng: cả hai lớp đều nhận phụ thuộc qua **constructor**.

```java
public PricingService(PriceRuleRepository priceRuleRepository,
                      SubscriptionRepository subscriptionRepository,
                      MembershipPlanRepository membershipPlanRepository) {
    this.priceRuleRepository = priceRuleRepository;
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
| `pom.xml` | Khai báo thư viện `testng`, cấu hình plugin `surefire`, khai báo 2 profile | Thêm phần profile |
| `src/test/java/.../PricingServiceTest.java` | 8 hàm test module 1 | Thêm 3 test mới (mục A7) |
| `src/test/java/.../CourtBookingServiceTest.java` | 5 hàm test module 2 | Có sẵn từ đầu |
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
   │  testng.suiteXmlFile = src/test/resources/testng-module1-pricing.xml
   ▼
maven-surefire-plugin            ← plugin chạy test, sinh báo cáo
   │
   ▼
testng-module1-pricing.xml       ← liệt kê class nào được chạy + đăng ký listener
   │
   ▼
PricingServiceTest.java          ← code test thật sự chạy ở đây
```

Trình bày với thầy nên đi ngược chuỗi này: bắt đầu từ file test, rồi giải thích
dần ra ngoài tới lệnh chạy.

## A4. Vì sao annotation nằm một nơi, suite XML một nơi, script một nơi?

Ba tầng này thay đổi vì ba lý do khác nhau, nên tách ra:

**Tầng 1 — Code test (`*Test.java`): kiểm tra CÁI GÌ**

```java
@Listeners(ConsoleNarrator.class)
public class PricingServiceTest {

    @Test(description = "Kiểm tra chiết khấu hội viên có gói tập hoạt động")
    public void testMemberDiscountActiveSubscription() { ... }
}
```

Annotation phải nằm sát code mà nó mô tả. `description` viết bằng tiếng Việt vì
nó chính là dòng chữ hiện ra lúc chạy. Tầng này đổi khi **quy tắc nghiệp vụ đổi**.

**Tầng 2 — Suite XML (`testng-*.xml`): chạy NHỮNG TEST NÀO cùng nhau**

```xml
<suite name="Arena3-Module1-Pricing" verbose="1">
    <listeners>
        <listener class-name="com.arena3.testsupport.ConsoleNarrator" />
    </listeners>
    <test name="Pricing-And-Discount-Rules">
        <classes>
            <class name="com.arena3.service.PricingServiceTest" />
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
& .\mvnw.cmd -o -Pmodule1-pricing test
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
| `@Test` | 13 phương thức | Đánh dấu đây là một test |
| `description` | mọi `@Test` | Câu mô tả tiếng Việt, hiện lúc chạy và trong báo cáo |
| `@BeforeMethod` | `setUp()` | Dựng lại mock mới trước **từng** test → các test độc lập |
| `@DataProvider` | `timePriceProvider` | 1 hàm × 4 bộ dữ liệu = 4 lượt chạy |
| `expectedExceptions` | 2 test module 2 | Khai báo "test này *phải* ném lỗi" |
| `@Listeners` + `ITestListener` | `ConsoleNarrator` | Móc vào vòng đời để in tường thuật |
| Suite XML | 3 file `testng*.xml` | Chia nhóm test, đăng ký listener |
| Maven profile | `pom.xml` | Chọn suite nào được chạy |

### Mockito — đồ giả thay cho database

```java
priceRuleRepository = Mockito.mock(PriceRuleRepository.class);
when(priceRuleRepository.findMatchingRules(eq("badminton"), eq("weekday"), anyInt()))
        .thenReturn(List.of(rule));
```

Dịch ra tiếng Việt: *"tạo một PriceRuleRepository giả; khi ai đó hỏi luật giá cầu
lông ngày thường, trả về luật giá tôi vừa dựng sẵn"*. Nhờ vậy test chạy xong
trong ~2 giây và chạy được ở mọi máy, không cần cài Postgres.

### Hai kiểu kiểm tra — điểm dễ được hỏi

```java
Assert.assertEquals(result.getPriceVnd(), 140000);            // kiểm tra TRẠNG THÁI
verify(occupancyRepository, times(1)).deleteById(oldOccId);   // kiểm tra HÀNH VI
```

- `Assert` kiểm tra **kết quả trả về** có đúng không.
- `verify` kiểm tra **service có gọi đúng thao tác, đúng số lần** không.

Cái thứ hai bắt được lỗi mà `Assert` bỏ sót — ví dụ xoá cùng một bản ghi hai
lần: trạng thái cuối vẫn đúng, nhưng hành vi thì sai. Người 2 sẽ dùng kiểu này.

### Đọc con số tổng kết

```
Tổng lượt chạy: 11   Đạt: 8   Thất bại: 3   Bỏ qua: 0
```

Module 1 chỉ có **8 phương thức** `@Test` nhưng báo **11 lượt chạy**. Không mâu
thuẫn: `testLookupPriceDynamic` dùng `@DataProvider` nên chạy 4 lần với 4 bộ dữ
liệu. TestNG đếm theo **lượt chạy thực tế**, không đếm theo số hàm.

---

## A6. Module 1 — các test ĐẠT

```powershell
.\run-tests.ps1 1
```

### Bốn lượt kiểm tra bảng giá theo khung giờ

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

> Nếu thầy hỏi: tham số `minutes` (540, 1080, 420, 600 — số phút tính từ 0 giờ)
> khai báo trong `@DataProvider` nhưng không dùng trong thân hàm, nó chỉ đóng vai
> trò chú thích cho người đọc dễ đối chiếu với cột thời gian.

### Ưu tiên bảng giá riêng của sân

`testCourtSpecificPriceRulePriority`

Dựng hai luật giá cùng lúc: luật chung toàn môn cầu lông **140.000đ**, và luật
riêng cho sân VIP **200.000đ**. Kỳ vọng hệ thống chọn **200.000đ**.

Ý nghĩa: luật cụ thể phải đè lên luật tổng quát. Nếu chọn sai, sân VIP bị bán
bằng giá sân thường — trung tâm mất tiền mà không ai phát hiện.

### Chiết khấu hội viên — cặp thuận và nghịch

| Test | Tình huống | Kỳ vọng |
|---|---|---|
| `testMemberDiscountActiveSubscription` | Gói **cầu lông** còn hạn, giảm 20% | Giảm **20%** |
| `testMemberDiscountDifferentSport` | Gói **bóng rổ**, đang đặt sân **cầu lông** | Giảm **0%** |

Đây là cặp test quan trọng về mặt phương pháp: một cái chứng minh tính năng
**chạy đúng khi được phép**, một cái chứng minh nó **không chạy khi không được
phép**. Chỉ có test thứ nhất thì lỗi "giảm giá cho mọi môn" sẽ lọt lưới.

### Công thức tính tiền

`testApplyDiscountRounding`

```
140.000đ giảm 15%  →  140.000 × 0,85 = 119.000đ
140.000đ giảm  0%  →  140.000đ (giữ nguyên)
```

---

## A7. Module 1 — BA TEST TRƯỢT

Đây là phần đáng giá nhất của bài. Cả ba test đều trượt vì **code có lỗi thật**,
không phải vì viết sai kỳ vọng. Cả ba đều nằm trong `PricingService`.

### Lỗi 1 — Gói tập chưa tới ngày bắt đầu đã được giảm giá

```
-> Gói tập chưa tới ngày bắt đầu thì chưa được giảm giá
   FAIL: Gói tập phải tới ngày 2026-10-01 mới có hiệu lực, chưa được giảm giá hôm nay
         expected [0] but found [20]
```

**Tình huống:** khách mua trước gói tập bắt đầu từ 10 ngày nữa. Hôm nay khách đặt
sân → hệ thống đã giảm ngay 20%, dù gói chưa tới ngày hiệu lực.

**Nguyên nhân** — `PricingService.memberDiscount()` chỉ kiểm tra **ngày kết thúc**:

```java
for (SubscriptionEntity s : subs) {
    if (!s.getEndOn().isBefore(today)) {        // chỉ xét endOn
        ...
        res.setPct(p.getCourtDiscountPct());
    }
}
```

Trường `startOn` có trong dữ liệu nhưng **không hề được dùng**. Gói nào cũng coi
như đã bắt đầu.

**Cách sửa:** thêm điều kiện `!s.getStartOn().isAfter(today)`.

### Lỗi 2 — Giảm giá trên 100% cho ra giá âm

```
-> Phần trăm giảm giá không được vượt quá 100%
   FAIL: Giảm 150% cho ra giá -70000đ - trung tâm phải trả tiền cho khách
```

**Tình huống:** người quản trị nhập nhầm `150` thay vì `15` khi cấu hình gói hội
viên. Giá sân 140.000đ trở thành **âm 70.000đ** — nghĩa là trung tâm phải trả
tiền cho khách.

**Nguyên nhân** — `applyDiscount()` chỉ chặn cận dưới, quên cận trên:

```java
public int applyDiscount(int list, int pct, int round) {
    if (pct <= 0) return list;                        // chặn pct âm
    double net = list * (1.0 - (double) pct / 100.0); // nhưng pct = 150 thì net âm
    return (int) (Math.round(net / round) * round);
}
```

**Cách sửa:** kẹp `pct` vào khoảng 0–100 trước khi tính, hoặc chặn kết quả không
được nhỏ hơn 0.

### Lỗi 3 — Làm tròn khiến khách trả nhiều hơn giá đã giảm

```
-> Làm tròn không được khiến khách trả nhiều hơn giá đã chiết khấu
   FAIL: Khách phải trả 122000đ trong khi giá sau chiết khấu chỉ là 121.800đ
```

**Tình huống:** giá sân 140.000đ, giảm 13%.

```
Giá đúng sau chiết khấu:  140.000 × 0,87 = 121.800đ
Hệ thống thu của khách:                    122.000đ
                                          ─────────
Khách trả dư:                                  200đ
```

**Nguyên nhân** — `Math.round` làm tròn về số gần nhất, nên `121,8` nghìn thành
`122` nghìn, tức **làm tròn lên**:

```java
return (int) (Math.round(net / round) * round);   // 121.800 → 122.000
```

**Cách sửa:** dùng `Math.floor` để làm tròn xuống, nghiêng về phía có lợi cho
khách — khách không bao giờ phải trả nhiều hơn giá đã niêm yết sau giảm.

Lỗi này nhỏ (200đ) nhưng nhân với hàng nghìn lượt đặt sân thì thành con số thật,
và về nguyên tắc là **thu sai so với giá đã công bố**.

### Vì sao có test trượt lại là điều tốt

Ý nên chốt bài:

1. **Cả ba lỗi đều vô hình với kiểm thử thủ công.** Bấm tay trên giao diện, ai
   cũng chỉ thử trường hợp bình thường: gói đang còn hạn, giảm 15%, giá tròn số.
   Không ai nghĩ tới gói *chưa bắt đầu*, hay tới việc nhập nhầm *150%*.

2. **Tám test đạt kia vẫn không cứu được.** Đã có sẵn test kiểm tra chiết khấu
   (`testMemberDiscountActiveSubscription`) và test kiểm tra làm tròn
   (`testApplyDiscountRounding`) — nhưng cả hai chỉ thử **trường hợp đẹp**. Lỗi
   nằm ở **trường hợp biên**, chỗ chưa ai hỏi tới.

3. **Ba lỗi thuộc ba loại khác nhau**, cho thấy test bắt được nhiều kiểu sai:
   - Lỗi 1: **thiếu kiểm tra dữ liệu đầu vào** (quên trường `startOn`)
   - Lỗi 2: **thiếu chặn giá trị biên** (không giới hạn trần phần trăm)
   - Lỗi 3: **sai hướng làm tròn** trong công thức tính tiền

4. **Một bộ test mà mọi thứ đều xanh chưa chắc là tin tốt** — nhiều khi chỉ có
   nghĩa là ta chưa hỏi đủ khó. Giá trị của kiểm thử tự động nằm ở chỗ nó tìm ra
   lỗi *trước khi* người dùng gặp, chứ không phải ở con số 100% đạt.

---

# PHẦN B — NGƯỜI THUYẾT TRÌNH 2

> Chỉ trình bày module 2. Phần nền tảng chung người 1 đã nói rồi.

## Module 2: Giữ chỗ sân và chống trùng lịch

```powershell
.\run-tests.ps1 2
```

Kết quả: **5 lượt chạy, 5 đạt, 0 trượt.**

`CourtBookingService.holdBooking()` là phương thức phức tạp nhất hệ thống: nó
phải kiểm tra sân có tồn tại không, có đang bảo trì không, khung giờ có bị trùng
không, tính giá, rồi mới tạo bản ghi giữ chỗ. Năm test dưới đây phủ từng nhánh.

### B1. Giữ chỗ thành công

`testHoldBookingSuccess`

Sân trạng thái `ready`, khung giờ trống. Kỳ vọng:
- Tạo booking trạng thái `hold`, giá 140.000đ, đánh dấu giờ cao điểm
- **Ghi đúng một** bản ghi chiếm dụng loại `hold`

```java
verify(occupancyRepository, times(1)).save(argThat(occ ->
        "hold".equals(occ.getKind()) && occ.getCourtId().equals(courtId)
));
```

`times(1)` quan trọng: ghi hai bản ghi chiếm dụng sẽ làm sân bị khoá vĩnh viễn —
đây là loại lỗi mà chỉ kiểm tra kết quả trả về sẽ không phát hiện được.

### B2. Chống trùng lịch

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

### B3. Từ chối sân đang bảo trì

`testHoldBookingCourtInMaintenance`

Sân ở trạng thái `maintenance`. Kỳ vọng ném lỗi vi phạm quy tắc **BR-12**.

```java
Assert.assertEquals(ex.getBr(), "BR-12", "Phải báo vi phạm quy tắc BR-12");
```

Mã quy tắc `BR-12` (Business Rule 12) được gắn vào lỗi để bộ phận vận hành biết
chính xác quy tắc nào bị vi phạm, thay vì chỉ nhận một câu báo lỗi chung chung.

### B4. Chống chiếm dụng sân

`testHoldBookingReplacesOldHold`

**Tình huống:** khách đang giữ sân A, nay giữ thêm sân B (sân B còn trống).

**Kỳ vọng:** lượt giữ sân A tự động chuyển `cancelled` và bản ghi chiếm dụng của
nó được giải phóng **đúng một lần**.

```java
Assert.assertEquals(oldHold.getStatus(), "cancelled");
verify(occupancyRepository, times(1)).deleteById(oldOccId);
```

Ý nghĩa nghiệp vụ: một người **không được giữ nhiều sân cùng lúc** để "xí chỗ".
Nếu thiếu quy tắc này, một khách có thể giữ hết sân trống rồi thong thả chọn.

### B5. Huỷ lượt giữ chỗ

`testCancelBookingSuccess`

Huỷ một booking đang `hold`. Kỳ vọng: `success = true`, trạng thái đổi thành
`cancelled`, `occupancyId` được xoá về `null`, và bản ghi chiếm dụng bị xoá.

Điểm đáng nói: test kiểm tra **cả ba việc phải xảy ra cùng nhau**. Nếu code chỉ
đổi trạng thái mà quên xoá bản ghi chiếm dụng, sân sẽ hiển thị là "đã đặt" mãi
mãi dù booking đã huỷ — một lỗi rất khó phát hiện bằng mắt.

### Tổng kết module 2

| Test | Nhánh được phủ |
|---|---|
| `testHoldBookingSuccess` | Đường đi thuận lợi |
| `testHoldBookingOverlapConflict` | Xung đột khung giờ → 409 |
| `testHoldBookingCourtInMaintenance` | Sân không khả dụng → BR-12 |
| `testHoldBookingReplacesOldHold` | Quy tắc chống chiếm dụng |
| `testCancelBookingSuccess` | Nghiệp vụ huỷ đặt |

Năm test phủ đủ các nhánh rẽ chính của `holdBooking()`, gồm cả **một nhánh thành
công** và **hai nhánh từ chối** với hai mã lỗi khác nhau.

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
| `BUILD FAILURE` khi chạy module 1 | **Đúng như thiết kế** — có 3 test trượt (mục A7) | Không phải hỏng, đó là nội dung cần trình bày |
