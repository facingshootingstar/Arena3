# Hướng dẫn demo kiểm thử TestNG — Arena3 Backend

Tài liệu cho buổi thuyết trình hai người.

- **Người 1** trình bày phần nền tảng chung (TestNG là gì, cấu trúc dự án, cách
  chạy) rồi demo **module 1 — tính giá**, trong đó có **3 test trượt**.
- **Người 2** chỉ trình bày **module 2 — giữ chỗ sân**, toàn bộ đều đạt.

---

## 0. Chạy nhanh

Mở terminal trong thư mục `backend/`:

```powershell
.\run-tests.ps1 1      # Người 1 — tính giá & chiết khấu   (12 lượt, 9 đạt, 3 TRƯỢT)
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

### Kiểm soát dữ liệu đầu vào (data control)

Đây là nhóm ưu điểm dễ bị bỏ qua nhưng lại là thứ TestNG mạnh hơn hẳn. Có hai
cơ chế, khác nhau ở chỗ **dữ liệu nằm ở đâu**:

**Mục 1 — Dữ liệu nằm trong code: `@DataProvider`**

```java
@DataProvider(name = "timePriceProvider")
public Object[][] timePriceProvider() {
    return new Object[][]{
            {"2026-09-16T09:00:00+07:00", "weekday", 540,  80000, false},
            {"2026-09-16T18:00:00+07:00", "weekday", 1080, 140000, true},
            ...
    };
}

@Test(dataProvider = "timePriceProvider")
public void testLookupPriceDynamic(String isoTime, String dayKind, int minutes,
                                   int expectedPrice, boolean expectedPeak) { ... }
```

Một hàm test, bốn bộ dữ liệu, TestNG chạy **bốn lượt độc lập** — lượt này trượt
không ảnh hưởng lượt kia, và báo cáo chỉ ra chính xác bộ dữ liệu nào hỏng.

Giá trị thực tế: muốn phủ thêm ca "thứ 7 lúc 22:00" thì **thêm một dòng dữ
liệu**, không viết thêm hàm test. Không có `@DataProvider`, bốn ca này hoặc phải
viết bốn hàm gần như giống hệt nhau, hoặc nhét vào một hàm với vòng lặp — mà khi
đó ca thứ hai trượt sẽ chặn luôn ca thứ ba, và báo cáo chỉ đếm được **một** test.

**Mục 2 — Dữ liệu nằm ngoài code: `@Parameters` + XML**

```xml
<suite name="Arena3-Module1-Pricing">
    <parameter name="basePrice" value="140000" />
    <parameter name="roundTo"   value="1000" />
    ...
</suite>
```

```java
@Test
@Parameters({ "basePrice", "roundTo" })
public void testApplyDiscount(int basePrice, int roundTo) { ... }
```

Dữ liệu được **tiêm từ file cấu hình vào tham số của hàm test**, nên đổi dữ liệu
thì sửa XML là xong — **không biên dịch lại Java**. Cùng một bộ test có thể chạy
với bảng giá khác nhau cho môi trường dev và môi trường thật.

| | `@DataProvider` | `@Parameters` |
|---|---|---|
| Dữ liệu nằm ở | Code Java | File `testng.xml` |
| Số lượt chạy | Nhiều lượt (1 lượt / 1 dòng) | Một lượt |
| Kiểu dữ liệu | Bất kỳ object nào | Chuỗi, TestNG tự ép kiểu |
| Đổi dữ liệu | Phải biên dịch lại | Sửa XML, chạy luôn |
| Hợp với | Nhiều ca kiểm thử của cùng 1 logic | Cấu hình theo môi trường |

Bài này dùng **mục 1**; mục 2 nêu ra để thấy TestNG kiểm soát dữ liệu ở cả hai
tầng trong và ngoài code.

## A3. Những gì đã thêm vào dự án

| File | Vai trò | Ghi chú |
|---|---|---|
| `pom.xml` | Khai báo thư viện `testng`, cấu hình plugin `surefire`, khai báo 2 profile | Thêm phần profile |
| `src/test/java/.../PricingServiceTest.java` | 9 hàm test module 1 | Thêm 3 test trượt (mục A7) |
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

## A5. Kiến trúc TestNG

TestNG được thiết kế theo kiến trúc **module hoá**: mỗi phần lo một việc và
giao tiếp với nhau qua giao diện rõ ràng, nên có thể **cấu hình linh hoạt và
mở rộng** mà không đụng vào lõi.

```
                    ┌────────────────────────────┐
                    │    XML Configuration       │
                    │  suite / test / class /    │
                    │  group / parameter         │
                    └─────────────┬──────────────┘
                                  │ nạp cấu hình
                                  ▼
  ┌────────────────┐   ┌────────────────────────────┐   ┌──────────────────┐
  │   Annotation   │──▶│      TestNG Engine         │◀──│  Data Provider   │
  │   Processor    │   │  lõi thực thi: dựng danh   │   │  bơm dữ liệu vào │
  │  (reflection)  │   │  sách, xếp thứ tự, chạy    │   │  test method     │
  └────────────────┘   └─────────────┬──────────────┘   └──────────────────┘
                                     │ phát sự kiện vòng đời
                                     ▼
                    ┌────────────────────────────┐
                    │    Listener & Reporter     │
                    │  bắt sự kiện → báo cáo      │
                    └────────────────────────────┘
```

### Năm thành phần, và chúng nằm ở đâu trong dự án này

| Thành phần | Nhiệm vụ | Hiện diện trong dự án |
|---|---|---|
| **TestNG Engine** | Lõi thực thi: đọc cấu hình, dựng danh sách test, điều khiển quá trình chạy, thu kết quả | Được `maven-surefire-plugin` khởi động qua thư viện `surefire-testng` |
| **XML Configuration** | File `testng.xml` định nghĩa suite, test, class, group, parameter | `testng.xml`, `testng-module1-pricing.xml`, `testng-module2-booking.xml` |
| **Annotation Processor** | Dùng **reflection** quét class, đọc `@Test`, `@BeforeMethod`… rồi dựng vòng đời chạy | Xử lý `@Test`, `@BeforeMethod`, `@DataProvider`, `@Listeners` trong 2 class test |
| **Data Provider** | Cung cấp dữ liệu cho test method từ `@DataProvider` | `timePriceProvider` — 4 bộ dữ liệu cho `testLookupPriceDynamic` |
| **Listener & Reporter** | Bắt sự kiện test, sinh báo cáo HTML/XML | `ConsoleNarrator` (tự viết) + báo cáo Surefire trong `target/surefire-reports/` |

### Vì sao "module hoá" không chỉ là chữ trên slide

Bài này có **bằng chứng sống** cho cả hai tính chất:

- **Cấu hình linh hoạt** — chia bài cho hai người chỉ bằng cách viết thêm hai
  file XML. Engine, annotation, code test **không đổi một dòng**.
- **Mở rộng được** — `ConsoleNarrator` là một Reporter **do nhóm tự viết**, cắm
  vào bằng cách implement `ITestListener`:

```java
public class ConsoleNarrator implements ITestListener {
    @Override public void onStart(ITestContext context)      { ... }  // mở đầu suite
    @Override public void onTestStart(ITestResult result)    { ... }  // trước mỗi test
    @Override public void onTestSuccess(ITestResult result)  { ... }  // test đạt
    @Override public void onTestFailure(ITestResult result)  { ... }  // test trượt
    @Override public void onTestSkipped(ITestResult result)  { ... }  // test bị bỏ qua
    @Override public void onFinish(ITestContext context)     { ... }  // in bảng tổng kết
}
```

Engine tự gọi các hàm này tại đúng thời điểm trong vòng đời. Ta **không sửa
TestNG**, chỉ cắm thêm một mảnh vào chỗ nó chừa sẵn — đó chính là điều kiến trúc
module hoá cho phép.

### Các annotation và thành phần dùng trong bài

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
Tổng lượt chạy: 12   Đạt: 9   Thất bại: 3   Bỏ qua: 0
```

Module 1 chỉ có **9 phương thức** `@Test` nhưng báo **12 lượt chạy**. Không mâu
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

### Làm tròn VND theo BR-43

`testRoundingIsHalfUpPerBr43` — khóa đúng chữ trong đặc tả: làm tròn tới
**1.000đ, làm tròn nửa lên** (BR-43), và chỉ làm tròn **một lần** sau chiết khấu
(BR-43A).

```
140.000đ giảm 13%  →  121.800đ  →  thu 122.000đ   (nửa lên)
140.000đ giảm 12%  →  123.200đ  →  thu 123.000đ   (nửa xuống)
```

Test này trông tầm thường về mặt số học, nhưng nó là chỗ **đặc tả thắng cảm
tính**: trực giác nói "làm tròn xuống cho có lợi cho khách", BR-43 nói "nửa lên".
Test viết theo BR, không viết theo trực giác — và chính chỗ này từng làm nhóm
hiểu sai (xem ghi chú cuối mục A7).

---

## A7. Module 1 — BA TEST TRƯỢT

Đây là phần đáng giá nhất của bài. Cả ba test đều trượt vì **code có lỗi thật**,
không phải vì viết sai kỳ vọng. Cả ba đều nằm trong `PricingService`.

> **Gốc rễ chung: đặc tả thiếu quy tắc, không chỉ là code cẩu thả.**
> Khi đối chiếu ba lỗi này với `attachments/A3-SRS-001` (bản 1.3.1) thì **không có
> BR nào** nói gói phải tới `start_on` mới có hiệu lực, **không có BR nào** giới
> hạn phần trăm giảm trong `[0, 100]`, và **không có BR nào** nói phải làm gì khi
> chưa cấu hình bảng giá. Lập trình viên không sai vì lười — họ không có câu nào
> để đọc. Vì vậy SRS đã được vá lên **v1.3.2**, thêm **BR-19A, BR-34A, BR-34B,
> BR-43A** và **TC-41…TC-44**; mỗi test trượt dưới đây giờ dẫn được về một mã BR.
> Đó là chiều ngược của truy vết: test không chỉ tìm lỗi code, nó còn tìm **lỗ
> hổng trong đặc tả**.

### Lỗi 1 — Gói tập chưa tới ngày bắt đầu đã được giảm giá (BR-19A)

```
-> BR-19A: gói chưa tới ngày bắt đầu thì chưa mở quyền lợi giảm giá
   FAIL: BR-19A: gói chỉ có hiệu lực từ 2026-10-07, hôm nay chưa được giảm giá
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

**Cách sửa:** thêm điều kiện `!s.getStartOn().isAfter(today)` — đúng như BR-19A
mới bổ sung, và trạng thái đó gọi là **Scheduled**, không phải Active.

### Lỗi 2 — Giảm giá trên 100% cho ra giá âm (BR-34A)

```
-> BR-34A: phần trăm giảm của gói phải nằm trong [0, 100]
   FAIL: BR-34A: giảm 150% cho ra giá -70000đ - giá sau giảm phải nằm trong
         [0, giá niêm yết]
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

**Cách sửa:** theo BR-34A, **từ chối** giá trị ngoài `[0, 100]` ngay khi lưu cấu
hình — không kẹp im lặng về 100, vì kẹp im lặng biến một lỗi nhập liệu thành một
đơn miễn phí mà không ai biết.

### Lỗi 3 — Chưa cấu hình bảng giá, hệ thống tự bịa ra giá để bán (BR-34B)

```
-> BR-34B: chưa cấu hình bảng giá thì không được tự bịa ra giá để bán
   FAIL: Không có luật giá nào khớp mà hệ thống vẫn báo 100000đ - BR-34B cấm giá
         mặc định ngầm, phải từ chối báo giá
         expected [0] but found [100000]
```

**Tình huống:** trung tâm mở thêm khung giờ 07:00 cho bóng rổ nhưng quản lý chưa
kịp nhập bảng giá. Lễ tân bán sân bình thường, hệ thống báo **100.000đ** — một con
số không có trong bất kỳ bảng giá nào.

**Nguyên nhân** — `lookupPrice()` không tìm được luật giá nào thì **tự điền một giá
mặc định** thay vì báo lỗi cấu hình:

```java
if (match != null) {
    res.setPriceVnd(match.getPriceVnd());
    res.setPeak(match.isPeak());
} else {
    res.setPriceVnd(100000);   // giá từ đâu ra? không ai cấu hình con số này
    res.setPeak(false);
}
```

**Tại sao nguy hiểm hơn hai lỗi trên:** nó **thất bại trong im lặng**. Không có
thông báo lỗi, không có dòng log, giao diện vẫn đẹp, phiếu thu vẫn in. Sai lệch
doanh thu chỉ lộ ra khi đối soát cuối tháng, và lúc đó không còn biết đã bán bao
nhiêu lượt ở giá sai.

**Cách sửa:** theo BR-34B, từ chối báo giá và báo lỗi cấu hình cho quản lý.

> **Ghi chú trung thực — chỗ này tài liệu đã từng viết sai.**
> Bản trước của mục A7 nêu lỗi 3 là *"làm tròn khiến khách trả dư 200đ"*
> (140.000 × 0,87 = 121.800 → thu 122.000). Đối chiếu SRS thì **đó không phải
> lỗi**: **BR-43** ghi rõ *"làm tròn tới 1.000 đồng, làm tròn nửa lên"*, tức
> `Math.round` đang làm **đúng đặc tả**. Test cũ đã bị thay bằng
> `testRoundingIsHalfUpPerBr43` — nay là một test **đạt**, khóa đúng hành vi BR-43
> — và BR-43A được thêm vào SRS để chốt thứ tự tính tiền và nói thẳng rằng chênh
> lệch tối đa 499đ theo hướng lên là **đúng**, không phải thu vượt. Nếu ai hỏi
> "sao không làm tròn xuống cho có lợi cho khách", câu trả lời là: **đặc tả quyết
> định, không phải cảm tính** — muốn đổi thì sửa BR-43 trước, rồi mới sửa code.

### Vì sao có test trượt lại là điều tốt

Ý nên chốt bài:

1. **Cả ba lỗi đều vô hình với kiểm thử thủ công.** Bấm tay trên giao diện, ai
   cũng chỉ thử trường hợp bình thường: gói đang còn hạn, giảm 15%, giá tròn số.
   Không ai nghĩ tới gói *chưa bắt đầu*, hay tới việc nhập nhầm *150%*.

2. **Chín test đạt kia vẫn không cứu được.** Đã có sẵn test kiểm tra chiết khấu
   (`testMemberDiscountActiveSubscription`) và test kiểm tra làm tròn
   (`testApplyDiscountRounding`) — nhưng cả hai chỉ thử **trường hợp đẹp**. Lỗi
   nằm ở **trường hợp biên**, chỗ chưa ai hỏi tới.

3. **Ba lỗi thuộc ba loại khác nhau**, cho thấy test bắt được nhiều kiểu sai:
   - Lỗi 1: **thiếu kiểm tra dữ liệu đầu vào** (quên trường `startOn`) — BR-19A
   - Lỗi 2: **thiếu chặn giá trị biên** (không giới hạn trần phần trăm) — BR-34A
   - Lỗi 3: **thất bại trong im lặng** (tự bịa giá thay vì báo lỗi) — BR-34B

4. **Viết test còn sửa được cả đặc tả.** Ba lỗi này lộ ra ba chỗ SRS chưa nói
   gì; SRS đã lên v1.3.2 với BR-19A, BR-34A, BR-34B, BR-43A. Ngược lại, một
   kỳ vọng ban đầu về hướng làm tròn bị chính SRS phủ nhận (BR-43) và đã bị loại
   — **đối chiếu đặc tả vừa thêm được luật, vừa loại được cáo buộc sai**.

5. **Một bộ test mà mọi thứ đều xanh chưa chắc là tin tốt** — nhiều khi chỉ có
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

Sân ở trạng thái `maintenance`. Test kiểm tra hệ thống có từ chối và có gắn
**mã quy tắc nghiệp vụ** vào lỗi hay không:

```java
Assert.assertEquals(ex.getBr(), "BR-12", "Phải báo vi phạm quy tắc BR-12");
```

Ý tưởng của mã `BR-xx` (Business Rule): lỗi trả về không chỉ là một câu chữ, mà
kèm **mã quy tắc bị vi phạm**, để bộ phận vận hành tra thẳng vào SRS.

### ⚠️ Phát hiện khi đối chiếu với SRS — nên chủ động nêu

Test này **cố tình giữ nguyên `BR-12`** để khớp với code hiện tại, nhưng khi tra
[A3-SRS-001-v1.3.1.md](../attachments/A3-SRS-001-v1.3.1.md) thì **mã này sai**:

| Mã | Nội dung thật trong SRS |
|---|---|
| **BR-12** | *"Gói chưa thanh toán: Subscription pending/expired/frozen không mở quyền ghi danh lớp và thuê sân giá TV/quota"* → nói về **gói hội viên**, không liên quan sân bảo trì |
| **BR-36** | *"Bảo trì / sự kiện chiếm slot: Lịch bảo trì và event block chiếm court+time như booking confirmed"* → **đây mới đúng** |
| **BR-35** | Ngày trung tâm đóng vì bảo trì cả ngày |

Code tại `CourtBookingService.java:96` ném `BR-12`:

```java
if (!"ready".equalsIgnoreCase(court.getStatus())) {
    throw ApiException.br("BR-12", "Sân đang bảo trì.");   // lẽ ra phải là BR-36
}
```

**Cách trình bày:** đây không phải lỗi logic — hệ thống **vẫn từ chối đúng**, sân
bảo trì vẫn không đặt được. Nhưng **mã quy tắc trả về sai**, nên nhân viên vận
hành tra SRS sẽ ra nhầm quy tắc về công nợ thay vì quy tắc bảo trì.

Câu nên nói:

> "Test này em để nguyên `BR-12` cho khớp code. Nhưng khi đối chiếu với SRS thì
> BR-12 là quy tắc về **gói chưa thanh toán**, còn quy tắc bảo trì là **BR-36**.
> Hệ thống chặn đúng, nhưng **báo sai mã quy tắc**. Đây là loại lỗi chỉ lộ ra khi
> đọc test cùng với tài liệu đặc tả."

🎯 *Nêu chủ động sẽ ăn điểm; để thầy mở SRS ra bắt được thì ngược lại.*

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

**Test này khớp đúng SRS** — nên trích ra khi trình bày:

> **BR-39 [F7 · cứng] Một hold / user:** *"Tạo hold mới tự hủy hold cũ chưa
> thanh toán của cùng user."*

Liên quan: **BR-31** quy định hold mềm hết hạn sau 5 phút khi đang thanh toán.

🎯 *Trích được đúng mã BR từ SRS cho thấy test bám đặc tả chứ không viết theo cảm
tính — ngược hẳn với trường hợp `BR-12` ở B3.*

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
