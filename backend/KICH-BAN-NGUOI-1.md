# Kịch bản thuyết trình — Người 1 | ⏱ 7 PHÚT

> **Bối cảnh:** 3 bạn trước đã nói overview + giới thiệu TestNG lý thuyết.
> **Nhiệm vụ:** kéo lý thuyết đó xuống code thật đang chạy.
> **Giới hạn: 7 phút** — mọi thứ trong file này đã được cắt cho vừa.

---

## ⚠️ LUẬT SỐNG CÒN CỦA BÀI 7 PHÚT

**1. Gõ lệnh chạy test ngay ở giây thứ 30, rồi nói tiếp trong lúc nó build.**
Build mất 20–40 giây. Nếu đứng im chờ là mất 10% thời lượng. Nói đè lên nó.

**2. Phần 3 lỗi phải còn đủ 2 phút 45.** Thà bỏ bớt phần giới thiệu còn hơn bị
cắt ngang lúc đang nói về lỗi.

**3. Không đọc code trên màn hình thành tiếng.** Chỉ vào, nói ý nghĩa.

**4. Nhìn đồng hồ ở mốc 3:30.** Chưa tới phần 3 lỗi thì bỏ ngay phần đang nói.

---

## 🎯 HAI KEY (7 phút chỉ nhồi được 2 ý)

> **KEY 1 — Test chạy không cần database**, ~2 giây, máy nào cũng chạy.
> Vì vậy nó **thực sự được chạy**, chứ không nằm chết trong repo.

> **KEY 2 — Bộ test của em trượt 3 cái, và đó là phần giá trị nhất.**
> Cả 3 đều là lỗi thật trong code tính tiền. Bấm tay không đời nào tìm ra.

**Câu chốt — học thuộc nguyên văn:**

> *"Một bộ test toàn màu xanh không chứng minh code đúng — nhiều khi nó chỉ
> chứng minh mình chưa hỏi đủ khó."*

---

## ❌ KHÔNG NÓI (3 bạn trước đã dùng hết)

- TestNG là gì, so với JUnit
- Đọc danh sách annotation `@Test`, `@BeforeMethod`…
- Ưu điểm chung của kiểm thử tự động
- Giảng lại 5 thành phần kiến trúc

---

# KỊCH BẢN

## ⏱ 0:00 – 0:30 | Mở đầu + bấm chạy

**Nói (vừa nói vừa chuyển sang terminal):**

> "Ba bạn vừa rồi đã trình bày TestNG về mặt lý thuyết. Phần của em ngược lại:
> em mở code thật của hệ thống Arena3 và chạy trực tiếp cho cả lớp xem — kể cả
> những test trượt."

**Gõ luôn, đừng chờ:**

```powershell
.\run-tests.ps1 1
```

> "Em cho nó chạy trước, trong lúc chờ em giới thiệu code."

---

## ⏱ 0:30 – 1:30 | Code đang được test (nói trong lúc build)

**Chiếu:** `PricingService.java`

> "Arena3 là hệ thống quản lý trung tâm thể thao. Em không test cả hệ thống, em
> chọn lớp `PricingService` — lớp tính tiền. Sai ở đây là **thu sai tiền khách**."

**Chỉ vào constructor:**

```java
public PricingService(PriceRuleRepository priceRuleRepository, ...)
```

**KEY 1 — nói chậm chỗ này:**

> "Chi tiết này quyết định cả bài: service **không tự tạo** repository bên trong
> mà **nhận từ ngoài vào**. Nên lúc test em truyền đồ giả thay cho database."

> "Kết quả: toàn bộ test chạy **không cần cài Postgres**, xong trong 2 giây,
> máy ai cũng chạy được. Đó là lý do bộ test này thực sự được dùng."

**Nếu build vẫn chưa xong, nói thêm câu này:**

> "Dòng chữ tiếng Việt sắp hiện ra không phải của TestNG — nó là class
> `ConsoleNarrator` **nhóm em tự viết**, cắm vào TestNG qua `ITestListener`.
> Nhóm em không sửa TestNG, chỉ cắm thêm vào chỗ nó chừa sẵn."

---

## ⏱ 1:30 – 2:30 | Kết quả chạy

**Chỉ vào dòng tổng kết:**

```
Tổng lượt chạy: 11   Đạt: 8   Thất bại: 3
```

**Chặn thắc mắc trước:**

> "Em viết **8 hàm** test nhưng báo **11 lượt chạy** — không phải lỗi. Một hàm
> dùng `@DataProvider` với 4 bộ dữ liệu nên chạy 4 lần. TestNG đếm theo lượt
> chạy thực tế."

**Gom 8 test đạt vào đúng 2 ý, không kể lần lượt:**

> "8 test đạt kiểm tra bảng giá theo khung giờ và chiết khấu hội viên. Em chỉ
> nói một cặp đáng chú ý:"

| Test | Tình huống | Kỳ vọng |
|---|---|---|
| Gói **cầu lông** còn hạn | | Giảm **20%** |
| Gói **bóng rổ**, đặt sân **cầu lông** | | Giảm **0%** |

> "Em cố ý viết thành đôi: một cái chứng minh tính năng **chạy đúng khi được
> phép**, một cái chứng minh nó **không chạy khi không được phép**. Thiếu cái
> thứ hai thì lỗi 'giảm giá cho mọi môn' lọt hoàn toàn."

---

## ⏱ 2:30 – 5:15 | ⭐ BA TEST TRƯỢT (phần chính)

**Mở — dứt khoát, không xin lỗi:**

> "Giờ tới phần em muốn nói nhất. Bộ test của em **trượt 3 cái**. Em không sửa
> cho nó xanh. Cả 3 đều trượt vì **code có lỗi thật**, và cố ý là **3 loại lỗi
> khác nhau**."

### Lỗi 1 — Quên đọc một trường dữ liệu (45 giây)

```
expected [0] but found [20]
```

> "Khách mua trước gói tập, 10 ngày nữa mới bắt đầu. Hôm nay đặt sân **đã được
> giảm 20%** rồi."

```java
if (!s.getEndOn().isBefore(today)) {     // chỉ kiểm tra ngày KẾT THÚC
```

> "Trường `startOn` có trong dữ liệu nhưng **không hề được dùng**. Nên gói nào
> cũng bị coi như đã bắt đầu."

### Lỗi 2 — Quên chặn giá trị biên (40 giây)

> "Admin nhập nhầm **150%** thay vì 15%. Giá sân 140 nghìn thành **âm 70 nghìn**
> — trung tâm phải trả tiền cho khách."

```java
if (pct <= 0) return list;    // chặn cận DƯỚI, quên cận TRÊN
```

> "Lỗi kinh điển: nghĩ tới một đầu mà quên đầu kia."

### Lỗi 3 — Sai hướng làm tròn (50 giây) ⭐ kể kỹ nhất

**Chiếu to:**

```
Giá sân:        140.000đ
Giảm 13%:       140.000 × 0,87 = 121.800đ
Hệ thống thu:                    122.000đ
                               ──────────
Khách trả dư:                        200đ
```

> "`Math.round` làm tròn về số **gần nhất**, nên 121,8 nghìn thành 122 nghìn —
> tức là làm tròn **lên**."

> "200 đồng nghe nhỏ. Nhưng nhân hàng nghìn lượt đặt sân là tiền thật, và quan
> trọng hơn: đây là **thu sai so với giá trung tâm đã công bố**. Sửa bằng
> `Math.floor` — làm tròn xuống, nghiêng về phía khách."

### 🎤 CHỐT (30 giây) — học thuộc

> "Hai ý về 3 lỗi này."

> "**Một**, cả 3 đều **vô hình với bấm tay**. Thử tay thì ai cũng chỉ thử ca
> bình thường — gói còn hạn, giảm 15%, giá tròn số. Không ai nghĩ tới gói *chưa
> bắt đầu* hay gõ nhầm *150%*."

> "**Hai**, và đây mới đáng sợ: **8 test đạt kia không cứu được**. Em đã có sẵn
> test chiết khấu và test làm tròn, nhưng cả hai chỉ thử **trường hợp đẹp**. Lỗi
> nằm ở **trường hợp biên**."

> "Nên nếu bài em toàn màu xanh, em nghĩ nó còn **kém tin cậy hơn** bây giờ. Một
> bộ test toàn xanh không chứng minh code đúng — nhiều khi nó chỉ chứng minh
> **mình chưa hỏi đủ khó**."

---

## ⏱ 5:15 – 6:00 | Chia việc cho 2 người + chuyển

> "Một điểm cuối. Để chia bài cho 2 người chạy riêng, nhóm em **chỉ thêm 2 file
> XML** — không sửa một dòng Java nào. Cái 'cấu hình linh hoạt' các bạn vừa
> nghe, cụ thể nó là như vậy."

> "Phần em là bài toán **tính tiền**. Còn `CourtBookingService` là bài toán khác
> hẳn: **nhiều người tranh một cái sân**, ở đó **thứ tự thao tác** mới quyết
> định. Em mời bạn [tên]."

**→ Còn dư ~1 phút làm đệm cho câu hỏi và phần chạy chậm.**

---

# 📋 CHECKLIST TRƯỚC KHI LÊN

- [ ] **Chạy `.\run-tests.ps1 1` một lần trước buổi** — để Maven tải sẵn thư
      viện. Không làm bước này, lúc demo có thể đứng chờ tải cả phút → **vỡ bài**
- [ ] Terminal đã `cd` vào `backend`, lệnh đã gõ sẵn, chỉ việc Enter
- [ ] Phóng to chữ terminal (Ctrl + `+`)
- [ ] Mở sẵn 2 tab: `PricingService.java`, `PricingServiceTest.java`
- [ ] Kiểm tra tiếng Việt không ra dấu `?`
- [ ] **Ảnh chụp màn hình kết quả để trong slide dự phòng** — phòng khi build hỏng
- [ ] Bấm giờ tập thử **ít nhất 2 lần**. 7 phút trôi nhanh hơn bạn tưởng

---

# ❓ CÂU HỎI DỄ BỊ HỎI

| Câu hỏi | Trả lời ngắn |
|---|---|
| **"Sao không sửa 3 lỗi cho xanh hết?"** ⭐ chắc chắn bị hỏi | "Sửa được ạ, mỗi lỗi vài dòng. Nhưng mục tiêu là trình bày **năng lực của bộ test**. Sửa code thì test xanh, và em mất luôn bằng chứng là test **đã bắt được** 3 lỗi đó." |
| "Mock là gì?" | "Đồ giả thay cho database. Em bảo nó: ai hỏi luật giá cầu lông thì trả về luật này. Dùng database thật thì test chậm và lúc đạt lúc trượt → không ai tin nó nữa." |
| "Sao build báo đỏ FAILURE?" | "Có test trượt thì Maven trả mã lỗi khác 0 — đúng thiết kế. Thực tế chính cái này chặn code lỗi không cho đẩy lên." |
| "11 lượt nhưng 8 hàm?" | "`@DataProvider` 4 bộ dữ liệu nên 1 hàm chạy 4 lần." |
| "Chạy máy khác được không?" | "Được, không cần database, script tự tìm JDK 17." |

---

# ✂️ ĐÃ CẮT GÌ SO VỚI BẢN ĐẦY ĐỦ

Nếu bị hỏi tới thì có sẵn trong đầu, nhưng **đừng chủ động kể**:

| Nội dung | Vì sao cắt |
|---|---|
| Bảng ánh xạ 5 thành phần kiến trúc → file | 3 bạn trước đã giảng, nhắc lại là trùng |
| Sơ đồ chuỗi chạy `run-tests.ps1` → … → test | Tốn 1 phút, không phục vụ 2 key |
| Bảng 7 file đã thêm vào dự án | Liệt kê file không thuyết phục bằng chạy thật |
| Sự cố tiếng Việt dấu `?` (code page 437) | Hay nhưng là chuyện bên lề. **Để dành trả lời nếu được hỏi** |
| Sự cố VS Code không đọc XML → thêm `@Listeners` | Như trên |
| 4 lượt test bảng giá theo khung giờ | Gộp vào câu "8 test đạt kiểm tra bảng giá và chiết khấu" |
| Test ưu tiên giá sân VIP | Như trên |

> Hai sự cố kỹ thuật (UTF-8 và VS Code) là **vũ khí dự phòng**: nếu giám khảo hỏi
> "nhóm em gặp khó khăn gì", kể ngay — chúng chứng minh nhóm tự debug thật.
