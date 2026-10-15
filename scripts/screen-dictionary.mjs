// Screen dictionary: a real screenshot of every screen, one page each, in few words with the keywords
// highlighted, plus a "What changed" part with before/after shots.
//   node scripts/screen-dictionary.mjs            -> shoots, builds docs/screen-dictionary/index.html and docs/Arena3-Screen-Dictionary.pdf
//   node scripts/screen-dictionary.mjs --no-shoot -> rebuild the document from the existing images
// The before/after shots come from scripts/screen-dictionary-changes.mjs (run it first; it needs the previous
// version running too). Needs the app running on http://127.0.0.1:8080 (seeded demo data). It only READS: it
// never clicks a button that writes (no booking, payment, shift, promo...), so it is safe on any database. The
// only thing it creates is a sign-in session per role; set SESSIONS=path/to/sessions.json to reuse saved ones.
// At night the browser clock is moved to 09:30 (ICT) so the hall reads as open and the grid has free hours;
// it keeps ticking, so animations still play. SHOOT_AT=<ISO time> picks another moment, SHOOT_AT=now keeps the
// real clock. Run the app with PGLITE_DATA_DIR=memory to leave the stored data untouched.
// The GSAP pages need frames caught mid-animation: the script slows GSAP's global timeline and
// pauses it at the right moment (dev server only: it reaches GSAP at /src/lib/gsap.ts). The
// in-app moments (a hold, a payment) create data, so they are shot only with MOMENTS=1, and only
// ever against PGLITE_DATA_DIR=memory. ONLY=GSAP reshoots just the frames.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:8080";
const noShoot = process.argv.includes("--no-shoot");
const OUT = "docs/screen-dictionary";
mkdirSync(`${OUT}/img`, { recursive: true });

const ROLES = {
  public: { vn: "Khách (chưa đăng nhập)", phone: null, color: "#475069" },
  member: { vn: "Hội viên", phone: "0901230103", color: "#1e4fd8" },
  receptionist: { vn: "Lễ tân", phone: "0900000002", color: "#9a5200" },
  coach: { vn: "Huấn luyện viên", phone: "0901110011", color: "#0f766e" },
  manager: { vn: "Quản lý", phone: "0900000001", color: "#9f1239" },
};

// How a screen is reached.
//   dock  : on the top bar (computer) and the bottom bar (phone)
//   sheet : on the top bar (computer); on a phone it sits under «Thêm» in the bottom bar
//   more  : under «Thêm» on both; `group` is the heading it sits under in that menu
const nav = (label, where = "dock", group = null) => ({ label, where, group });
const reach = (n) => {
  const L = `«${n.label}»`;
  const inMore = n.group ? `«Thêm» → ${n.group} → ${L}` : `«Thêm» → ${L}`;
  if (n.where === "more") return { d: `Thanh trên: ${inMore}`, m: `Thanh dưới: ${inMore}` };
  if (n.where === "sheet") return { d: `Thanh trên: ${L}`, m: `Thanh dưới: ${inMore}` };
  return { d: `Thanh trên: ${L}`, m: `Thanh dưới: ${L}` };
};

// [role, route, title, nav|string, purpose, who, actions[{t, mark}], note, extra (caption of a second shot), tab, view]
// Copy is short on purpose: one or two plain sentences, keywords marked ==like this== (drawn as a highlighter),
// @[/route] becomes that screen's code. `mark` = visible label of the control; when it is found on screen a
// numbered circle is drawn on the shot. `extra` adds a second page: the bottom of the page, or (with `tab`) the
// n-th tab opened, or (with a CSS selector as `tab`) that section scrolled into view, or (with a route as `tab`)
// that page. `view` is a button label clicked before the shots, for a filter that changes what is shown and
// nothing stored (a report period). All of it is read-only.
const A = (t, mark) => ({ t, mark });
const S = [
  // ── Public
  ["public", "/", "Trang chủ", "Mở website của trung tâm",
    "Trang giới thiệu cho ==người chưa có tài khoản==. Nhìn là biết ==đang mở cửa không==, ==còn bao nhiêu giờ trống== và ==giá từ bao nhiêu==.",
    "Bất kỳ ai, chưa cần tài khoản.",
    [A("Bấm ==Đặt sân== để xem lịch trống", "Đặt sân"), A("Bấm ==Xem sân & bảng giá==", "Xem sân & bảng giá"), A("==Đăng nhập== hoặc tạo tài khoản", "Đăng nhập")],
    "Cuộn xuống: lịch sân trống, giá, gói, lớp. Giờ mở cửa lấy từ ==Cài đặt==.",
    "Cuộn xuống: lịch sân trống trực tiếp", "#schedule"],
  ["public", "/login", "Đăng nhập", "Bấm «Đăng nhập» ở trang chủ",
    "Cửa vào chung. Nhập ==số điện thoại hoặc email== và ==mật khẩu==, hệ thống tự đưa bạn tới ==đúng khu theo vai trò==.",
    "Hội viên và nhân viên đã có tài khoản.",
    [A("Bấm ==Quên mật khẩu?== nếu quên", "Quên mật khẩu?"), A("Bấm ==Tạo tài khoản== nếu chưa có", "Tạo tài khoản")],
    "Hàng ==Tài khoản demo== chỉ có ở bản xem thử."],
  ["public", "/register", "Tạo tài khoản", "Bấm «Tạo tài khoản» ở trang đăng nhập",
    "Người mới tự tạo ==tài khoản hội viên==. Hệ thống gửi ==mã 6 số== qua email để xác nhận.",
    "Người chưa là hội viên.",
    [A("Điền thông tin, ==tự chọn ngày sinh=="), A("Đọc ==điều khoản==, rồi ==tự tick== ô đồng ý", "điều khoản sử dụng"), A("Bấm ==Gửi mã xác nhận==", "Gửi mã xác nhận"), A("Nhập mã 6 số là xong")],
    "Dưới 16 tuổi phải điền thêm ==người giám hộ==."],
  ["public", "/forgot", "Quên mật khẩu", "Bấm «Quên mật khẩu?» ở trang đăng nhập",
    "Nhập số điện thoại, nhận ==mã 6 số== qua email (==hết hạn sau 5 phút==), rồi đặt ==mật khẩu mới==.",
    "Ai quên mật khẩu.",
    [A("Nhập số điện thoại, bấm ==Gửi mã==", "Gửi mã"), A("Nhập mã và mật khẩu mới")],
    "Tài khoản không có email thì nhờ ==lễ tân== đặt mật khẩu tạm."],
  ["public", "/terms", "Điều khoản và dữ liệu cá nhân", "Link trong ô đồng ý ở màn «Tạo tài khoản»",
    "Hai trang ==mới==: ==Điều khoản sử dụng== và ==Thông báo về dữ liệu cá nhân== (Nghị định 13/2023).",
    "Người sắp tạo tài khoản, hoặc ai muốn đọc lại.",
    [A("Đọc từng mục"), A("Đổi ==EN | VI== để đọc tiếng Anh")],
    "Nội dung đang là ==bản nháp==, chờ trung tâm duyệt.",
    "Trang thứ hai: thông báo về dữ liệu cá nhân", "/privacy"],

  // ── Member
  ["member", "/app", "Trang chủ hội viên", nav("Lịch"),
    "Màn đầu tiên sau khi đăng nhập: khối ==Hôm nay== (sân và lớp trong ngày), ==thẻ hội viên==, nhắc việc và ==thông báo mới==.",
    "Hội viên.",
    [A("Bấm ==Gia hạn== khi gói sắp hết", "Gia hạn"), A("Bấm ==Hủy== nếu không đến được", "Hủy"), A("Bấm ==Mở hộp thư== xem thông báo", "Mở hộp thư")],
    "Trên điện thoại, ô thao tác nhanh ẩn đi vì thanh dưới đã đủ mục."],
  ["member", "/app/book", "Đặt sân", nav("Đặt sân"),
    "Chọn ngày và môn, chạm một ==giờ trống== để ==giữ sân 5 phút==, rồi chọn cách trả trên thẻ giữ chỗ.",
    "Hội viên muốn chơi.",
    [A("Chọn ngày: mỗi ngày ghi ==số giờ trống== hoặc ==số lượt bạn đã có=="), A("Chạm ==ô viền xanh có dấu +=="), A("Bấm ==Có mã khuyến mãi?== nếu có mã", "Có mã khuyến mãi?"), A("Bấm ==Đổi giờ== ở sân đã đặt", "Đổi giờ")],
    "Mỗi ngày tối đa ==2 lượt==. Giờ ==đã bắt đầu== thì không đặt được nữa."],
  ["member", "/app/classes", "Lớp học", nav("Lớp học"),
    "Lớp có ==huấn luyện viên==, lọc theo môn. Mỗi thẻ nói rõ ==có học được không==: cần gói gì, dùng mấy buổi.",
    "Hội viên muốn học có người dạy.",
    [A("Lọc theo môn"), A("Bấm ==Đăng ký== (chưa có gói thì ==Xem gói tập==)", "Đăng ký"), A("Bấm ==Rời lớp này==, rồi xác nhận", "Rời lớp này"), A("Cuộn xuống: ==sổ điểm danh== của tôi")],
    "Lớp ==của bạn== xếp lên đầu. Lớp đầy thì vào ==danh sách chờ==.",
    "Cuộn xuống: sổ điểm danh của tôi"],
  ["member", "/app/train", "Tiến độ tập luyện", nav("Tiến độ", "sheet"),
    "Mục tiêu, trình độ, buổi sắp tới kèm ==giáo án==, ==bài tập về nhà== và nhận xét của huấn luyện viên.",
    "Hội viên đang học lớp.",
    [A("Chọn mục tiêu"), A("Đánh dấu bài tập đã làm"), A("Đọc nhận xét")],
    "AI chỉ gợi ý. Huấn luyện viên ==duyệt== thì hội viên mới thấy."],
  ["member", "/app/plans", "Gói tập", nav("Gói tập", "sheet"),
    "Các gói đang bán: môn, giá, thời hạn, quyền lợi. ==Đặt gói== ở đây, ==trả tiền tại quầy==.",
    "Hội viên muốn mua hoặc gia hạn.",
    [A("Nhập mã khuyến mãi nếu có"), A("So sánh các gói"), A("Bấm ==Mua hoặc gia hạn==", "Mua hoặc gia hạn")],
    "Trước khi trả đã thấy ==ngày hết hạn mới==."],
  ["member", "/app/points", "Điểm thưởng", nav("Điểm", "sheet"),
    "==Số dư điểm==, ==hạng==, đổi điểm lấy ==mã giảm giá==. Chi 10.000đ được 1 điểm, 1 điểm trị giá 100đ.",
    "Hội viên.",
    [A("Nhập số điểm, bấm ==Nhận mã==", "Nhận mã"), A("Xem ==lịch sử==, chuyển trang ở cuối")],
    "Đổi tối thiểu ==50 điểm==."],
  ["member", "/app/pass", "Mã QR vào cổng", nav("Mã QR"),
    "==Mã QR tự đổi mỗi phút== để lễ tân quét khi bạn đến. Chụp màn hình lại cũng ==không dùng được==.",
    "Hội viên khi đến trung tâm.",
    [A("Đưa mã cho lễ tân quét"), A("Bấm ==Mã mới== nếu hết hạn", "Mã mới"), A("==Tự vào cổng== (khi quản lý bật)")],
    null],
  ["member", "/app/assistant", "Trợ lý", "Nút trợ lý (biểu tượng chat) ở thanh trên",
    "Chat hỏi nhanh: giờ mở cửa, gói đang bán, ai dạy, hủy sân thế nào. Trả lời từ ==dữ liệu thật== của trung tâm.",
    "Hội viên có thắc mắc.",
    [A("Bấm câu gợi ý hoặc tự gõ"), A("Gõ ==ticket:== ở đầu câu để nhắn lễ tân")],
    "Không tư vấn y tế. Đặt sân, đăng ký lớp vẫn làm ở màn riêng."],
  ["member", "/app/notifications", "Thông báo", "Biểu tượng chuông ở thanh trên",
    "Hộp thư của hội viên. Thẻ ==chưa đọc== có chấm xanh. Danh sách ==chia trang==, xem được cả ==tin cũ==.",
    "Hội viên.",
    [A("Mở một thông báo"), A("Bấm ==Đánh dấu tất cả đã đọc==", "Đánh dấu tất cả đã đọc"), A("Chuyển trang ở cuối danh sách")],
    null],
  ["member", "/account", "Tài khoản", "Bấm avatar góc trên phải → «Cài đặt tài khoản»",
    "Bốn tab: Hồ sơ, ==Bảo mật== (đổi mật khẩu), ==Biên lai==, Hỗ trợ (nhắn lễ tân).",
    "Mọi người đã đăng nhập.",
    [A("Sửa hồ sơ", "Hồ sơ"), A("Đổi mật khẩu", "Bảo mật"), A("Xem biên lai", "Biên lai"), A("Nhắn lễ tân", "Hỗ trợ")],
    "Đổi số điện thoại hay email thì nhờ ==lễ tân==."],
  ["member", "/pay/return", "Kết quả thanh toán online", "Tự chuyển về sau khi trả tiền online",
    "Trang quay về sau khi ==trả online==. Báo một trong bốn kết quả: đang chờ, đã trả, đã hủy, chưa rõ.",
    "Hội viên vừa trả tiền online.",
    [A("Đọc kết quả"), A("Quay lại xem sân hoặc gói")],
    "Ảnh mở thẳng trang, không qua cổng thanh toán, nên báo ==chưa rõ==."],

  // ── Receptionist
  ["receptionist", "/desk", "Quầy lễ tân", nav("Quầy"),
    "Màn chính của lễ tân: ==mở ca==, tìm hội viên, thêm hội viên mới, và khối ==Ngay lúc này== (sân đang chơi, khách sắp đến, sân trống).",
    "Lễ tân.",
    [A("Bấm ==Mở ca== trước khi thu tiền", "Mở ca"), A("Tìm theo tên, số điện thoại, mã"), A("Thêm hội viên: bấm ==Tạo hồ sơ==", "Tạo hồ sơ"), A("Bấm ==Sơ đồ sân== để mở lưới", "Sơ đồ sân")],
    "==Yêu cầu hỗ trợ== từ ứng dụng ở cột phải, có chia trang."],
  ["receptionist", "/desk/gate", "Cổng", nav("Cổng"),
    "Quét ==QR của hội viên== để cho vào. Không có mã thì nhập ==số điện thoại==. ==Hợp lệ hay không== và lý do hiện ngay.",
    "Lễ tân đứng cổng.",
    [A("Quét bằng máy quét", "Quét mã"), A("Bấm ==Không có mã== để nhập số", "Không có mã"), A("Xem ==người đã vào== hôm nay, chia trang")],
    "Vào cổng ==không trừ buổi== của gói."],
  ["receptionist", "/desk/courts", "Sơ đồ sân", nav("Sân"),
    "Lưới cả ngày của mọi sân. Bấm ô trống để ==bán cho khách vãng lai==, bấm ô đã đặt để xem ==ai đang giữ==.",
    "Lễ tân.",
    [A("Chọn ngày và môn"), A("Bấm ==ô trống== để bán"), A("Bấm ==ô đã đặt== xem chi tiết")],
    "Nhân viên thấy cả ==giờ đã qua==. Màu ô: xem trang ==Đọc lưới sân==."],
  ["receptionist", "/desk/payments", "Thanh toán", nav("Thanh toán"),
    "Việc tiền tại quầy: gói chờ thu, ==chuyển khoản cần đối soát==, hoàn tiền chờ duyệt và ==toàn bộ biên lai==.",
    "Lễ tân (thu tiền), quản lý (duyệt hoàn tiền).",
    [A("Mở ca rồi mới thu được tiền", "Mở ca trước"), A("Đối soát: ==đã nhận== hay ==không thấy=="), A("Tìm biên lai, ==chọn số dòng mỗi trang==")],
    "Ảnh chụp khi ==chưa mở ca== nên nút thu tiền đang mờ."],
  ["receptionist", "/desk/day-passes", "Vé ngày", nav("Vé ngày", "sheet"),
    "Bán ==vé vào cửa một ngày== cho khách lẻ. Khách vào cổng thì bấm ==xác nhận==.",
    "Lễ tân.",
    [A("Điền thông tin khách"), A("Bấm ==Bán vé==", "Bán vé"), A("Xác nhận khi khách vào")],
    "Cần ==mở ca== trước. Danh sách vé chia trang."],
  ["receptionist", "/desk/series", "Đặt sân cố định", nav("Đặt cố định", "sheet"),
    "==Cùng sân, cùng giờ, mỗi tuần==. Trả trước cả đợt ==4 đến 12 tuần== và được giảm giá.",
    "Lễ tân.",
    [A("Nhập số điện thoại khách"), A("Chọn sân, ngày, giờ, số tuần"), A("Bấm ==Kiểm tra các tuần==", "Kiểm tra các tuần")],
    "Cần ==mở ca== trước khi thu cả đợt."],
  ["receptionist", "/desk/at-risk", "Sắp rời bỏ", nav("Sắp rời bỏ", "more"),
    "Hội viên ==có thể sắp bỏ==: vắng liên tiếp, lâu không đến, gói sắp hết. Gọi nhắc rồi ==ghi nhận liên hệ==.",
    "Lễ tân, để chăm sóc khách.",
    [A("Chọn nhóm cần gọi", "Cần gọi"), A("Gọi theo số trên dòng"), A("Bấm ==Ghi nhận liên hệ==", "Ghi nhận liên hệ")],
    "Muốn bán gói cho người này: mở hồ sơ @[/desk/member/$ID]."],
  ["receptionist", "/desk/classes", "Lớp học (quầy)", nav("Lớp học", "more"),
    "Xem các lớp: trạng thái, huấn luyện viên, lịch và ==sĩ số==.",
    "Lễ tân.",
    [A("Xem chỗ còn trống"), A("Bấm ==Buổi học & học viên==", "Buổi học & học viên")],
    "Chỉ để xem. Hội viên tự đăng ký ở @[/app/classes]."],
  ["receptionist", "/desk/gear", "Dụng cụ", nav("Dụng cụ", "more"),
    "Cho thuê ==vợt, bóng, ống cầu==. Kho ==tự trừ== khi cho thuê và ==tự cộng== khi trả.",
    "Lễ tân.",
    [A("Chọn món, người thuê, số lượng"), A("Bấm ==Cho thuê==", "Cho thuê"), A("Khách trả: bấm ==Nhận lại==", "Nhận lại")],
    null],
  ["receptionist", "/desk/maintenance", "Bảo trì", nav("Bảo trì", "more"),
    "Báo ==chỗ hỏng== (đèn, lưới, máy bơm), gắn vào sân và ==mức khẩn cấp==. Có thể ==khoá sân== đến khi sửa xong.",
    "Lễ tân và quản lý.",
    [A("Mô tả, chọn sân và mức"), A("Bấm ==Gửi phiếu==", "Gửi phiếu"), A("Chuyển trạng thái phiếu", "Đã sửa xong")],
    "Danh sách phiếu ==chia trang==."],
  ["receptionist", "/desk/member/$ID", "Hồ sơ hội viên", "Tìm ở @[/desk] rồi bấm vào tên",
    "Mọi thứ về ==một hội viên==: liên hệ, gói đang dùng, lượt đặt, thanh toán và biên lai.",
    "Lễ tân (quản lý mở từ màn Hội viên).",
    [A("Bấm ==Sửa hồ sơ==", "Sửa hồ sơ"), A("Bấm ==Đặt lại mật khẩu==", "Đặt lại mật khẩu"), A("Bấm ==Thu tiền==", "Thu tiền"), A("Bán thêm gói, đề nghị hoàn tiền")],
    "Thu bằng chuyển khoản có ==mã QR== của trung tâm."],
  ["receptionist", "/alerts", "Cảnh báo", "Biểu tượng chuông ở thanh trên",
    "Hộp thư ==cảnh báo== chung của nhân viên, ví dụ học viên ==vắng 3 buổi liền==.",
    "Nhân viên.",
    [A("Mở một cảnh báo"), A("Xử lý rồi đánh dấu đã đọc")],
    "Danh sách ==chia trang==. Ảnh có thể trống nếu chưa có cảnh báo."],

  // ── Coach
  ["coach", "/coach", "Lịch dạy", nav("Lịch"),
    "Thẻ ==Buổi tiếp theo== (giờ, sân, sĩ số) và các buổi ==sắp tới== chia theo ngày.",
    "Huấn luyện viên.",
    [A("Bấm ==Điểm danh ngay==", "Điểm danh ngay"), A("Bấm một buổi để mở sổ của buổi đó")],
    null],
  ["coach", "/coach/classes", "Lớp của tôi", nav("Lớp học"),
    "Các lớp ==bạn dạy==: tổng số lớp, tổng học viên; mỗi lớp có lịch, sân và ==sĩ số==.",
    "Huấn luyện viên.",
    [A("Xem lịch và sĩ số từng lớp"), A("Bấm ==Buổi học & học viên==", "Buổi học & học viên")],
    "Lớp do ==quản lý== phân công."],
  ["coach", "/coach/attendance", "Điểm danh", nav("Điểm danh"),
    "Một buổi chia ==4 bước==: Điểm danh, Kết quả, Giáo án, Bài tập về nhà. ==Ghi chú sức khoẻ== hiện ngay dưới tên.",
    "Huấn luyện viên.",
    [A("Bấm trạng thái từng học viên"), A("Bấm ==Đánh dấu tất cả có mặt==", "Đánh dấu tất cả có mặt"), A("Bấm ==Lưu điểm danh==", "Lưu điểm danh"), A("Bấm 2, 3, 4 để sang bước khác")],
    "Sổ ==tự khoá== sau một thời gian. Sửa sau đó phải ghi lý do.",
    "Bước 3: giáo án buổi tập", 2],
  ["coach", "/coach/student/$ID", "Hồ sơ học viên", "Bấm tên học viên trong @[/coach/attendance]",
    "Mục tiêu, trình độ, số buổi ==có mặt / muộn / vắng / có phép==, và ==ghi chú sức khoẻ==.",
    "Huấn luyện viên.",
    [A("Đọc ghi chú sức khoẻ"), A("Chuyển thẻ Tiến độ, Ghi chú, Lịch sử")],
    "Số ==có mặt== chỉ tăng khi đã ==lưu điểm danh==.",
    "Thẻ Lịch sử: buổi gần đây và bài tập", 2],
  ["coach", "/coach/earnings", "Thu nhập", nav("Thu nhập"),
    "Tiền dạy ==theo tháng==: một khoản ==mỗi buổi== cộng thêm ==mỗi học viên có mặt==.",
    "Huấn luyện viên.",
    [A("Đổi tháng bằng hai nút mũi tên"), A("Đối chiếu từng buổi đã dạy")],
    "Tháng ==chưa chốt== thì số còn có thể đổi."],

  // ── Manager
  ["manager", "/manager", "Báo cáo", nav("Báo cáo"),
    "Bức tranh kinh doanh: ==doanh thu==, hoàn tiền, ==công suất sân==, giờ đông khách, hội viên mới.",
    "Quản lý, chủ trung tâm.",
    [A("Chọn khoảng thời gian", "Hôm nay"), A("Lọc theo cách trả"), A("Xuất ==Excel, PDF, CSV==", "Xuất Excel")],
    "Ảnh đang chọn ==7 ngày== để có số liệu; mở trang thì mặc định là Hôm nay.",
    "Cuộn xuống: công suất sân và lớp học", null, "7 ngày"],
  ["manager", "/manager/classes", "Lớp học (quản lý)", nav("Lớp học", "sheet"),
    "==Tạo lớp==: môn, trình độ, sân, huấn luyện viên, lịch, sức chứa. Hệ thống ==chặn trùng lịch== sân và người dạy.",
    "Quản lý.",
    [A("Điền lớp mới"), A("Bấm ==Tạo và đăng==", "Tạo và đăng"), A("==Dời, hủy buổi== trong Buổi học & học viên", "Buổi học & học viên")],
    null],
  ["manager", "/manager/members", "Hội viên", nav("Hội viên"),
    "Mọi hội viên. Lọc nhanh theo ==gói==, tìm theo ==tên, số điện thoại, mã==. Danh sách ==chia trang==.",
    "Quản lý.",
    [A("Chọn nhóm lọc", "Tất cả"), A("Tìm hội viên"), A("Mở hồ sơ @[/desk/member/$ID]")],
    null],
  ["manager", "/manager/attendance", "Điểm danh (báo cáo)", nav("Điểm danh"),
    "Hội viên ==có thật sự đến tập==: ==tỉ lệ điểm danh== theo lớp và huấn luyện viên.",
    "Quản lý.",
    [A("Chọn khoảng ngày"), A("Xem theo lớp"), A("Xuất Excel hoặc PDF", "Xuất Excel")],
    "Tab ==Sắp rời bỏ== liệt kê ai cần gọi."],
  ["manager", "/manager/staff", "Nhân viên", nav("Nhân viên", "sheet"),
    "==Cấp tài khoản== lễ tân và huấn luyện viên. Đổi vai trò, ==đặt lại mật khẩu==, ==khoá== tài khoản.",
    "Quản lý.",
    [A("Bấm ==Thêm nhân viên==", "Thêm nhân viên"), A("Bấm ==Đặt lại mật khẩu==", "Đặt lại mật khẩu"), A("Bấm ==Khóa==", "Khóa")],
    "Nhân viên mới ==đổi mật khẩu== ở lần đăng nhập đầu."],
  ["manager", "/manager/plans", "Gói tập (quản lý)", nav("Gói tập", "more", "Kinh doanh"),
    "Mọi gói, đang bán và đã ngừng. Gói ==không bao giờ bị xoá==: ngừng bán thì người đang dùng vẫn giữ.",
    "Quản lý.",
    [A("Bấm ==Gói mới==", "Gói mới"), A("Bấm ==Chi tiết== để sửa giá", "Chi tiết"), A("==Ngừng bán== hoặc Bán lại", "Ngừng bán")],
    null],
  ["manager", "/manager/promos", "Khuyến mãi", nav("Khuyến mãi", "more", "Kinh doanh"),
    "==Mã giảm giá== theo % hoặc số tiền, có ==hạn dùng== và ==giới hạn lượt==.",
    "Quản lý.",
    [A("Bấm ==Mã mới==", "Mã mới"), A("==Tạm dừng== một mã", "Tạm dừng"), A("Xem ==Ai đã dùng==", "Ai đã dùng")],
    null],
  ["manager", "/manager/prices", "Bảng giá", nav("Bảng giá", "more", "Kinh doanh"),
    "Giá sân theo ==môn==, ==loại ngày== (thường, cuối tuần, lễ) và ==khung giờ== (thường, cao điểm).",
    "Quản lý.",
    [A("Mở từng môn"), A("Sửa giá trong ô"), A("Lưu thay đổi")],
    "Giá mới chỉ áp cho ==giao dịch mới==."],
  ["manager", "/manager/commission", "Hoa hồng huấn luyện viên", nav("Hoa hồng", "more", "Kinh doanh"),
    "Tiền trả huấn luyện viên ==theo tháng==. Đặt ==mức trả mỗi buổi== và ==mỗi học viên== cho từng người.",
    "Quản lý.",
    [A("Chọn tháng"), A("Sửa mức trả"), A("Bấm ==Lưu mức trả==", "Lưu mức trả")],
    "Tháng ==chưa chốt== thì số còn có thể đổi."],
  ["manager", "/manager/invoices", "Xuất hoá đơn điện tử", nav("Hoá đơn điện tử", "more", "Kinh doanh"),
    "Gửi hoá đơn tháng cho ==kế toán== dạng ==bảng tính (CSV)== hoặc ==XML==.",
    "Quản lý, kế toán.",
    [A("Chọn khoảng ngày"), A("Bấm ==Tải bảng tính (CSV)==", "Tải bảng tính (CSV)"), A("Bấm ==Tải XML==", "Tải XML")],
    "Chưa phải hoá đơn phát hành. Danh sách ==chia trang==."],
  ["manager", "/manager/audit", "Nhật ký thao tác", nav("Nhật ký", "more", "Hệ thống"),
    "==Ai làm gì, lúc nào==. Mở một dòng để xem ==trước và sau==. ==Không ai sửa hay xoá== được.",
    "Quản lý, để kiểm tra.",
    [A("Lọc theo thao tác, người, ngày"), A("==Tìm== trên toàn bộ nhật ký"), A("Mở một dòng")],
    null],
  ["manager", "/manager/settings", "Cài đặt trung tâm", nav("Cài đặt", "more", "Hệ thống"),
    "==Giờ mở cửa==, ==thời gian giữ sân==, bật tắt tính năng, trạng thái từng sân, thông tin pháp lý.",
    "Quản lý.",
    [A("Đổi giờ mở, đóng cửa"), A("Bật hoặc tắt tính năng"), A("Đổi trạng thái từng sân")],
    "Đổi giờ ở đây thì ==trang chủ==, ==Đặt sân==, ==Sơ đồ sân== đổi theo.",
    "Cuộn xuống: sân và thông tin trung tâm"],
];

// ── What changed since the previous version (main). Each change: before / after in a few words, the
// screens it touches, and before/after shots from scripts/screen-dictionary-changes.mjs
// (img/changes/C-<key>-b.jpg and -a.jpg). layout: "side" puts shots next to each other, "stack" one under the other.
// `grid` (optional) overrides the CSS grid of the shots, for shots of very different shapes.
const CH = (id, key, title, before, after, why, screens, layout, shots, grid) => ({ id, key, title, before, after, why, screens, layout, shots, grid });
const shot = (img, tag, cap) => ({ img, tag, cap });
const PAGING_SCREENS = ["/app/notifications", "/app/points", "/account", "/alerts", "/desk", "/desk/gate", "/desk/payments", "/desk/day-passes", "/desk/maintenance", "/desk/at-risk", "/manager/members", "/manager/attendance", "/manager/staff", "/manager/invoices", "/manager/audit"];
const CHANGES = [
  CH("C1", "paging", "Danh sách dài có ==phân trang==",
    "Chỉ có nút ==Trước / Sau==, hoặc danh sách dài mãi rồi ==ẩn tin cũ==.",
    "Thấy ==tổng số dòng==, nhảy tới trang bất kỳ, tự chọn ==10 / 25 / 50 / 100 dòng== mỗi trang.",
    "Biên lai, nhật ký, thông báo cũ đều tìm lại được, không phải bấm hàng chục lần.",
    PAGING_SCREENS, "stack",
    [shot("C-paging-b", "b", "Biên lai ở quầy: chỉ có Trước / Sau, trang 1/4."), shot("C-paging-a", "a", "Bây giờ: 1-25 trong 953 biên lai, chọn số dòng, nhảy tới trang 39.")]),
  CH("C2", "transfer", "Chuyển khoản có ==mã QR== của trung tâm",
    "Bấm Chuyển khoản chỉ hiện một dòng nhắc: ==không có số tài khoản==, không có QR.",
    "Hiện ==mã VietQR== quét bằng app ngân hàng, kèm số tài khoản, số tiền, nội dung chuyển khoản và nút ==sao chép==.",
    "Khách chuyển đúng tài khoản, đúng nội dung, lễ tân đối soát nhanh.",
    ["/app/book", "/desk/payments", "/desk/member/$ID"], "stack",
    [shot("C-transfer-b", "b", "Chỉ một dòng nhắc."), shot("C-transfer-a", "a", "QR tạo ngay trên máy, theo tài khoản trung tâm khai báo.")],
    "grid-template-rows:minmax(0,.3fr) minmax(0,1fr)"),
  CH("C3", "plan", "Chỉ hiện ==cách trả dùng được==",
    "Gói ==đã hết hạn== mà vẫn hiện nút ==Dùng giờ trong gói tập==. Chữ Holding your court chưa dịch.",
    "Chỉ hiện cách trả ==dùng được==. Còn giờ trong gói thì ghi ==còn bao nhiêu giờ==. Thẻ giữ chỗ có vòng đếm ngược.",
    "Hội viên không bấm vào một nút chắc chắn bị từ chối.",
    ["/app/book"], "stack",
    [shot("C-plan-b", "b", "Hội viên có gói đã hết hạn: vẫn mời dùng giờ trong gói."), shot("C-plan-a", "a", "Cùng hội viên: chỉ còn Chuyển khoản.")]),
  CH("C4", "daycap", "Báo trước ngày ==đã đủ lượt==",
    "Dải ngày luôn ghi ==Còn 16, Còn 63==, kể cả ngày bạn đã đủ 2 lượt (giữ sân sẽ bị từ chối).",
    "Ngày đã đủ lượt ghi ==Bạn đã đủ 4 lượt==. Giờ ==đang diễn ra== không còn tính là giờ trống.",
    "Mỗi ngày tối đa 2 lượt (BR-05), không đặt giờ đã qua (BR-07).",
    ["/app/book"], "stack",
    [shot("C-daycap-b", "b", "Trước: chỉ có số giờ trống."), shot("C-daycap-a", "a", "Bây giờ: ngày đã đủ lượt ghi rõ.")]),
  CH("C5", "classes", "Lớp học: biết trước ==có học được không==",
    "Chỉ có nút ==Đăng ký==; bấm rồi mới biết thiếu gói.",
    "Thẻ lớp ghi ==Cần gói cầu lông== kèm nút Xem gói tập; có gói thì ghi ==dùng 1 trong n buổi==. Rời lớp phải xác nhận, lớp của bạn lên đầu.",
    "Hội viên biết ngay việc cần làm, không gặp lỗi sau khi bấm.",
    ["/app/classes"], "side",
    [shot("C-classes-b", "b", "Hội viên có gói đã hết hạn: vẫn mời Đăng ký."), shot("C-classes-a", "a", "Cùng hội viên: nói rõ cần gói gì.")]),
  CH("C6", "register", "Tạo tài khoản: ==tự chọn ngày sinh==, ==đọc được điều khoản==",
    "Ngày sinh ==điền sẵn 15/01/1998==, ô đồng ý ==tick sẵn==, không có chỗ đọc điều khoản.",
    "Ngày sinh ==để trống==, ô đồng ý ==không tick sẵn==, có link tới hai trang mới: Điều khoản sử dụng và Dữ liệu cá nhân.",
    "Đồng ý phải là tự nguyện (Nghị định 13/2023); tuổi đúng thì mới biết ai cần người giám hộ.",
    ["/register", "/terms"], "side",
    [shot("C-register-b", "b", "Điền sẵn, tick sẵn."), shot("C-register-a", "a", "Để trống, có link."), shot("C-terms-a", "new", "Trang mới: Điều khoản sử dụng.")],
    "grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,.62fr);grid-template-rows:minmax(0,1fr)"),
  CH("C7", "venue", "Giờ mở cửa và thời gian giữ sân ==theo Cài đặt==",
    "Chữ và lưới ==viết cứng== 06:00-22:00 và năm phút. Đổi Cài đặt cũng không đổi.",
    "Đổi trong ==Cài đặt== (ví dụ 07:00-21:00, giữ 7 phút) thì trang chủ, Đặt sân, Sơ đồ sân ==đổi theo==.",
    "Một chỗ sửa, mọi màn nói cùng một giờ.",
    ["/", "/app/book", "/desk/courts", "/manager/settings"], "grid",
    [shot("C-venue-b", "b", "Cài đặt giữ 7 phút, trang vẫn ghi năm phút."), shot("C-venue-a", "a", "Ghi đúng 7 phút."), shot("C-venuegrid-b", "b", "Cài đặt mở 07:00, lưới vẫn bắt đầu 06."), shot("C-venuegrid-a", "a", "Lưới bắt đầu 07.")],
    "grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,.42fr) minmax(0,1fr)"),
  CH("C8", "bookm", "Đặt sân trên điện thoại ==gọn hơn==",
    "Ô mã khuyến mãi luôn mở, thanh dưới ==7 mục==, phải ==dò từng sân== để tìm giờ trống.",
    "Dải ==Giờ còn trống==: chạm giờ là ==tự chọn sân==. Mã khuyến mãi gập lại, thanh dưới còn 5 mục.",
    "Màn hình đầu tiên dành cho việc chính: chọn giờ.",
    ["/app/book"], "side",
    [shot("C-bookm-b", "b", ""), shot("C-bookm-a", "a", "")]),
  CH("C9", "desk", "Quầy lễ tân có khối ==Ngay lúc này==",
    "Lối tắt nằm một hàng trên cùng; ==không thấy== sân đang chơi hay khách sắp đến.",
    "Cột phải có khối ==Ngay lúc này==: số đang chơi, vào sân trong 1 giờ tới, ==sân trống giờ này==.",
    "Lễ tân nhìn một chỗ là biết sắp phải làm gì.",
    ["/desk"], "side",
    [shot("C-desk-b", "b", ""), shot("C-desk-a", "a", "")]),
];
// Small fixes, listed without shots: [before, after, screens].
const SMALL = [
  ["Thẻ giữ chỗ ghi ==Holding your court== (tiếng Anh)", "==Đang giữ sân cho bạn==", ["/app/book"]],
  ["Hiệu ứng ==tia lửa khi bấm== ở mọi màn, kể cả màn làm việc", "Chỉ còn ở ==trang công khai== (trang chủ, đăng nhập...)", ["/", "/login", "/register"]],
  ["Menu ==Bảng giá== dùng chung biểu tượng với ==Cài đặt==", "Bảng giá có ==biểu tượng đồng xu== riêng", ["/manager/prices"]],
  ["Chữ hiển thị có ==dấu gạch dài (—)==", "Viết lại thành câu ngắn, ==không còn dấu gạch dài==", ["/", "/login", "/desk", "/app/book"]],
];
// The prototype waiting for approval (img/changes/proto/*.jpg, shot from branch proto/book-hour-first).
const PROTO = {
  title: "Bản thử: đặt sân ==theo giờ trước==, sân sau",
  what: "Hầu hết mọi người muốn ==một sân lúc 7 giờ==, không phải ==sân số 9==. Màn Đặt sân mở ra là ==dãy giờ== kèm số sân trống; chọn giờ thì hiện ==các sân trống, giá và nút Giữ sân này==. Lưới cũ vẫn còn sau nút ==Xem tất cả sân==.",
  status: "Đang chờ duyệt. Chưa nằm trong bản chính.",
  shots: [["1-phone-first-screen", "Điện thoại: màn đầu tiên"], ["3-phone-held", "Điện thoại: đã giữ sân"], ["4-desktop-time-first", "Máy tính: giờ trước, lưới gập lại"]],
};

// ── GSAP: what each effect is, where, and what it says. [name, tools, routes, meaning]
const FX_LANDING = [
  ["Cuộn có quán tính", "ScrollSmoother", ["/"], "Trang trượt mượt; ảnh nền trôi chậm hơn chữ nên có ==chiều sâu==."],
  ["Thanh tiến độ, header tự ẩn", "ScrollTrigger", ["/"], "Vạch xanh cho biết ==đã đọc tới đâu==; header lui lên khi cuộn xuống."],
  ["Trạng thái tự giải mã", "ScrambleTextPlugin", ["/"], "==Đang mở cửa · đến 22:00== hiện ra như bảng điện tử, theo giờ thật."],
  ["Tiêu đề trồi lên từng dòng", "SplitText", ["/"], "Dẫn mắt vào ==nội dung chính==. Tách theo từ để dấu tiếng Việt không rời chữ."],
  ["Quả cầu bay tới nút", "MotionPathPlugin", ["/"], "Quả cầu lông đáp xuống nút ==Đặt sân==: hành động chính của trang."],
  ["Số đếm lên", "gsap.to", ["/"], "==Giờ trống==, ==giá sân==, ==giá gói== đếm từ 0 khi cuộn tới."],
  ["«Ba bước» đứng lại", "ScrollTrigger pin", ["/"], "Chọn, giữ, trả ==sáng lần lượt==, đúng thứ tự đặt sân. Chỉ trên máy tính."],
  ["Câu tuyên bố rõ dần", "SplitText scrub", ["/"], "Từng từ ==rõ dần theo tốc độ cuộn==: chỗ duy nhất trang muốn đọc chậm."],
  ["Lọc huấn luyện viên", "Flip", ["/"], "Đổi môn thì thẻ ==trượt về chỗ mới==, thấy được ai đi đâu."],
  ["Cơ sở vật chất trượt ngang", "containerAnimation", ["/"], "Cuộn dọc mà ảnh ==chạy ngang==, như đi dọc nhà thi đấu."],
  ["Thanh giờ cao điểm", "timeline", ["/"], "Ngày mở cửa vẽ từ ==bảng giá thật==: giờ thường trước, ==cao điểm== sau."],
  ["Thanh chỗ ngồi của lớp", "gsap.fromTo", ["/"], "Mỗi thanh chạy tới đúng ==tỉ lệ chỗ đã có người==."],
  ["Dải lớp học", "gsap.ticker", ["/"], "Cuộn mạnh thì ==chạy nhanh==, cuộn ngược thì chạy ngược."],
];
const FX_APP = [
  ["Vòng giữ sân", "DrawSVGPlugin", ["/app/book"], "Vòng tròn ==cạn dần theo thời gian giữ==, bám đồng hồ thật."],
  ["Phút cuối rung một lần", "CustomWiggle", ["/app/book"], "Còn ==60 giây== thì chuyển đỏ và rung nhẹ ==một lần==."],
  ["Mã đặt sân giải mã", "ScrambleTextPlugin", ["/app/book"], "Mã ==CRT-...== hiện từng ký tự đúng lúc được cấp."],
  ["Icon môn biến hình", "MorphSVGPlugin", ["/app/book"], "Đổi môn thì icon ==biến từ môn này sang môn kia==."],
  ["Tick và chấm sáng", "DrawSVG + Physics2D", ["/app/book", "/pay/return"], "Chỉ khi ==tiền thật sự được xác nhận==."],
];
const FX_CHIPS = {
  "/": ["ScrollSmoother", "ScrollTrigger", "SplitText", "ScrambleText", "MotionPath", "Flip", "timeline"],
  "/app/book": ["DrawSVG", "CustomWiggle", "ScrambleText", "MorphSVG", "Physics2D"],
  "/pay/return": ["DrawSVG", "Physics2D"],
};
// Each effect shot step by step (files G01-1.jpg, G01-2.jpg...), the last step being the finished
// state. [id, title, tools, route, caption, step labels]
const FRAMES = [
  ["G01", "Mở đầu trang chủ", "ScrambleText · SplitText", "/", "Dòng trạng thái giải mã, rồi tiêu đề trồi lên từng từ.", ["Trạng thái đang giải mã", "Tiêu đề đang trồi lên", "Xong"]],
  ["G02", "Quả cầu bay tới nút «Đặt sân»", "MotionPath · timeline", "/", "Bay theo đường cong rồi đáp xuống nút chính. Vòng xanh chanh chỉ để đánh dấu trong ảnh.", ["Bay vào từ mép phải", "Qua đỉnh đường cong", "Đáp xuống nút"]],
  ["G03", "Câu tuyên bố rõ dần theo cuộn", "SplitText · scrub", "/", "Cuộn tới đâu rõ tới đó.", ["Vừa cuộn tới", "Cuộn nửa đường", "Rõ cả câu"]],
  ["G04", "«Ba bước» đứng lại khi cuộn", "ScrollTrigger pin · scrub", "/", "Đường nối vẽ dần, ba bước lần lượt sáng.", ["Vừa đứng lại", "Tới bước 2", "Cả ba bước sáng"]],
  ["G05", "Lọc huấn luyện viên", "Flip", "/", "Thẻ còn lại trượt về chỗ mới thay vì nhảy.", ["Trước: Tất cả", "Đang trượt", "Sau: Bóng rổ"]],
  ["G06", "Cơ sở vật chất trượt ngang", "ScrollTrigger pin · containerAnimation", "/", "Cuộn dọc mà dãy ảnh chạy ngang.", ["Đầu đoạn", "Nửa đường", "Cuối đoạn"]],
  ["G07", "Thanh giờ cao điểm", "timeline", "/", "Giờ thường đổ trước, cao điểm 17:00-22:00 đổ sau.", ["Giờ thường đang đổ", "Cao điểm đang đổ", "Xong"]],
  ["G08", "Icon môn biến hình", "MorphSVG", "/app/book", "Đổi môn: icon trên ảnh đầu trang biến hình.", ["Cầu lông", "Đang biến hình", "Bóng rổ"]],
  ["G09", "Giữ sân: mã và vòng đếm ngược", "ScrambleText · DrawSVG", "/app/book", "Mã hiện từng ký tự; vòng cạn dần theo thời gian giữ.", ["Mã đang giải", "Mã đã cấp", "Còn khoảng 2 phút"]],
  ["G10", "Phút cuối", "CustomWiggle", "/app/book", "Qua mốc 60 giây: chuyển đỏ, rung nhẹ một lần.", ["Còn hơn 1 phút", "Mốc 60 giây: đang rung", "Sau đó: đỏ, đứng yên"]],
  ["G11", "Thanh toán xong", "DrawSVG · Physics2D", "/app/book", "Dấu tick tự vẽ, vài chấm sáng bung ra rồi rơi.", ["Vòng đang vẽ", "Chấm sáng đang bung", "Xong"]],
  ["G12", "Khi tắt chuyển động", "gsap.matchMedia", "/", "Máy bật ==giảm chuyển động==: không đứng lại, ba bước sáng sẵn.", ["Có chuyển động", "Giảm chuyển động"]],
];

const VP = { d: { width: 1440, height: 900 }, m: { width: 390, height: 844 } };
// While the hall is open the real clock is right. At night the grid is empty and the hero says "Closed", so
// the browser clock moves to 09:30 on the server's current day. The server still judges what is free by its
// own clock, so between 22:00 and midnight (today already over there) run after midnight or set SHOOT_AT.
const ictToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const ictHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(new Date()));
const shootAt =
  process.env.SHOOT_AT === "now"
    ? null
    : process.env.SHOOT_AT
      ? Date.parse(process.env.SHOOT_AT)
      : ictHour >= 6 && ictHour < 21
        ? null
        : Date.parse(`${ictToday}T09:30:00+07:00`);
if (!noShoot && !process.env.SHOOT_AT && ictHour >= 22) {
  console.warn("[dictionary] after 22:00 the server has already closed today: run after midnight or set SHOOT_AT");
}
const shootNote = shootAt
  ? ` Ảnh chụp với đồng hồ trình duyệt đặt lúc ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(shootAt))} để trung tâm đang mở cửa và lưới sân có giờ trống.`
  : "";
const login = async (phone) =>
  (await fetch(`${base}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, password: "ChangeMe!a3" }) })).json();

// Sessions: reuse saved ones when SESSIONS points at a file of {role: {token, user}}, sign in otherwise.
const sessionsFile = process.env.SESSIONS;
const saved = sessionsFile && existsSync(sessionsFile) ? JSON.parse(readFileSync(sessionsFile, "utf8")) : {};
const local = (p) => String(p ?? "").replace(/^\+84/, "0");
const sessions = {};
for (const [k, r] of Object.entries(ROLES)) {
  if (!r.phone) continue;
  const hit = Object.values(saved).find((s) => local(s?.user?.phone) === r.phone);
  sessions[k] = hit ?? (await login(r.phone));
  if (!hit && sessionsFile) saved[`${k}-${r.phone}`] = sessions[k];
}
if (sessionsFile) writeFileSync(sessionsFile, JSON.stringify(saved));
const demoId = sessions.member.user.id;
const idOf = (i) => `S${String(i + 1).padStart(2, "0")}`;
const marksFile = `${OUT}/marks.json`;
let marksFound = existsSync(marksFile) ? JSON.parse(readFileSync(marksFile, "utf8")) : {};

// Draw numbered circles on the page (fixed to the viewport) for the labels that exist on screen.
const drawMarks = (labels) => {
  const found = [];
  let count = 0;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[inert]");
  };
  const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
  for (const label of labels) {
    if (!label) { found.push(null); continue; }
    const want = norm(label);
    const cands = [...document.querySelectorAll("button, a, [role=button], [role=tab], label, summary")];
    const el = cands.find((c) => vis(c) && norm(c.textContent ?? "") === want) ?? cands.find((c) => vis(c) && norm(c.textContent ?? "").startsWith(want) && norm(c.textContent ?? "").length < want.length + 18);
    if (!el) { found.push(null); continue; }
    const r = el.getBoundingClientRect();
    count += 1;
    const d = document.createElement("div");
    d.textContent = String(count);
    d.setAttribute("data-mark", "1");
    d.style.cssText = `position:fixed;z-index:2147483647;left:${Math.max(2, r.left - 11)}px;top:${Math.max(2, r.top - 11)}px;width:22px;height:22px;border-radius:50%;background:#e11d74;color:#fff;font:700 12px/22px Arial,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.45);pointer-events:none`;
    document.body.appendChild(d);
    found.push(count);
  }
  return found;
};

const settle = async (page, route) => {
  await page.goto(base + route, { waitUntil: "networkidle" }).catch(() => undefined);
  if (route === "/") {
    // The landing's hero is one GSAP timeline ending with a shuttle served onto "Book a court".
    // Wait for that end state (shuttle gone, buttons fully in) rather than guessing a duration.
    await page
      .waitForFunction(
        () => {
          const s = document.querySelector("[data-shuttle]");
          const c = [...document.querySelectorAll("[data-cta] > *")];
          return !!s && getComputedStyle(s).visibility === "hidden" && c.length > 0 && c.every((x) => getComputedStyle(x).opacity === "1");
        },
        undefined,
        { timeout: 20000 },
      )
      .catch(() => undefined);
    await page.waitForTimeout(900);
  } else {
    await page.waitForTimeout(2200);
  }
};
const ctxFor = async (browser, size, role) => {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1.5, colorScheme: "light", isMobile: size.width < 500, hasTouch: size.width < 500 });
  const s = sessions[role];
  // Shift the clock rather than freeze it: GSAP and the countdowns read Date.now and must keep moving.
  await ctx.addInitScript((target) => {
    if (target == null) return;
    const offset = target - Date.now();
    const Real = Date;
    class Shifted extends Real {
      constructor(...a) {
        if (a.length) super(...a);
        else super(Real.now() + offset);
      }
      static now() {
        return Real.now() + offset;
      }
    }
    globalThis.Date = Shifted;
  }, shootAt);
  await ctx.addInitScript(([t, u]) => {
    localStorage.setItem("arena3.lang", "vi");
    if (t) {
      localStorage.setItem("arena3.token", t);
      localStorage.setItem("arena3.user", JSON.stringify(u));
    }
  }, [s?.token ?? null, s?.user ?? null]);
  return ctx;
};

/* ── GSAP frames ──────────────────────────────────────────────────────────────────────────
   GSAP's global timeline is reached through the dev server's /src/lib/gsap.ts (the same module the
   page uses), slowed down, and paused at the moment worth showing. Pausing GSAP changes nothing
   stored. The in-app frames need a hold and a payment, so they run only with MOMENTS=1. */
async function shootGsapFrames(browser) {
  // Crop to one element or the union of several, grown to an aspect if asked, kept below `top`
  // (the landing's fixed header) and inside the viewport. Returns the box so later steps of the
  // same effect can reuse it and the framing stays still while the effect moves.
  const shot = async (page, file, sel, { pad = 16, top = 0, aspect = 0, box = null } = {}) => {
    const clip =
      box ??
      (await page.evaluate(
        ([s, p, t, a]) => {
          // "text:<sel>" measures the element's content (a Range), not its full-width block box.
          const rectOf = (q) => {
            const el = document.querySelector(q.replace(/^text:/, ""));
            if (!el) return null;
            if (!q.startsWith("text:")) return el.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(el);
            return range.getBoundingClientRect();
          };
          const rs = (Array.isArray(s) ? s : s ? [s] : []).map(rectOf).filter(Boolean);
          let r = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
          if (rs.length) {
            r = {
              left: Math.min(...rs.map((x) => x.left)) - p,
              top: Math.min(...rs.map((x) => x.top)) - p,
              right: Math.max(...rs.map((x) => x.right)) + p,
              bottom: Math.max(...rs.map((x) => x.bottom)) + p,
            };
          }
          if (a) {
            const w = r.right - r.left;
            const h = r.bottom - r.top;
            if (w / h > a) {
              const g = (w / a - h) / 2;
              r.top -= g;
              r.bottom += g;
            } else {
              const g = (h * a - w) / 2;
              r.left -= g;
              r.right += g;
            }
          }
          const x = Math.max(0, r.left);
          const y = Math.max(t, r.top);
          return { x, y, width: Math.min(innerWidth, r.right) - x, height: Math.min(innerHeight, r.bottom) - y };
        },
        [sel, pad, top, aspect],
      ));
    await page.screenshot({ path: `${OUT}/img/${file}.jpg`, type: "jpeg", quality: 88, clip });
    console.log("frame", file);
    return clip;
  };
  // A ring drawn round something small (the shuttle) for the photo only, removed right after.
  const ring = (page, sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = Math.max(r.width, r.height) + 36;
      const o = document.createElement("div");
      o.setAttribute("data-frame-ring", "");
      Object.assign(o.style, {
        position: "fixed",
        left: `${r.left + r.width / 2 - d / 2}px`,
        top: `${r.top + r.height / 2 - d / 2}px`,
        width: `${d}px`,
        height: `${d}px`,
        borderRadius: "50%",
        border: "3px solid #c8f03c",
        boxShadow: "0 0 0 2px rgba(11,18,48,.6)",
        zIndex: "2147483647",
        pointerEvents: "none",
      });
      document.body.appendChild(o);
    }, sel);
  const unring = (page) => page.evaluate(() => document.querySelectorAll("[data-frame-ring]").forEach((n) => n.remove()));
  // Tag elements found by a script so the crop can name them.
  const tag = (page, js, arg) => page.evaluate(js, arg);
  const gsapCtx = async (role, opts = {}) => {
    const ctx = await browser.newContext({ viewport: VP.d, deviceScaleFactor: opts.dsf ?? 1.5, colorScheme: "light", reducedMotion: opts.reduce ? "reduce" : "no-preference" });
    const s = opts.session ?? sessions[role];
    // An adjustable clock (the hold frames jump to its last minute), starting where the shoot is set.
    // The in-app moments keep the real time: the server stamps a hold's expiry from its own clock.
    await ctx.addInitScript((target) => {
      let offset = target == null ? 0 : target - Date.now();
      const Real = Date;
      class Shifted extends Real {
        constructor(...a) {
          if (a.length) super(...a);
          else super(Real.now() + offset);
        }
        static now() {
          return Real.now() + offset;
        }
      }
      globalThis.Date = Shifted;
      window.__shift = (ms) => {
        offset += ms;
      };
    }, opts.realClock ? null : shootAt);
    await ctx.addInitScript(([t, u]) => {
      localStorage.setItem("arena3.lang", "vi");
      if (t) {
        localStorage.setItem("arena3.token", t);
        localStorage.setItem("arena3.user", JSON.stringify(u));
      }
    }, [s?.token ?? null, s?.user ?? null]);
    return ctx;
  };
  // Reach GSAP once the document is up, through the module the page itself loaded.
  const arm = (page, slow = 1) =>
    page.evaluate(async (x) => {
      const m = await import("/src/lib/gsap.ts");
      window.__gsap = m.gsap;
      window.__ST = m.ScrollTrigger;
      m.gsap.globalTimeline.timeScale(x);
    }, slow);
  // Block bodies on purpose: these calls return the timeline, and asking Playwright to serialise
  // GSAP's whole object graph hangs the page until the renderer runs out of memory.
  const speed = (page, v) => page.evaluate((x) => { window.__gsap.globalTimeline.timeScale(x); }, v);
  const freeze = (page) => page.evaluate(() => { window.__gsap.globalTimeline.pause(); });
  const thaw = (page) => page.evaluate(() => { window.__gsap.globalTimeline.resume(); });
  // Scrolling happens at full speed only: the smoother's catch-up runs on the global timeline, so a
  // slowed timeline would leave the page drifting between the steps of one frame.
  const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => undefined);
  // Progress (0..1) of the running tween on any element matching `sel` (finished entrances skipped).
  const progressOf = (sel) => {
    const tw = window.__gsap.getTweensOf(document.querySelectorAll(sel)).find((t) => t.isActive());
    return tw ? tw.progress() : -1;
  };
  const scrollToTrigger = (page, test, at) =>
    page.evaluate(
      ([t, a]) => {
        const st = window.__ST.getAll().find(new Function("s", `return (${t})(s)`));
        if (st) window.scrollTo(0, st.start + (st.end - st.start) * a);
        return !!st;
      },
      [test.toString(), at],
    );
  // The hero copy's scroll fade can be measured mid-intro at a wrong start (the copy then sits at
  // half opacity at the top of the page); re-measure at the frozen moment so the shot shows the
  // page's real scroll-0 state.
  const remeasure = (page) => page.evaluate(() => { window.__ST.refresh(); });
  const heroEnded = () => {
    const s = document.querySelector("[data-shuttle]");
    const c = [...document.querySelectorAll("[data-cta] > *")];
    return !!s && getComputedStyle(s).visibility === "hidden" && c.length > 0 && c.every((x) => getComputedStyle(x).opacity === "1");
  };

  // ── The landing, slowed to a quarter so its first seconds can be caught step by step.
  {
    const ctx = await gsapCtx("public");
    const page = await ctx.newPage();
    console.log("gsap: landing");
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    await arm(page, 0.25);
    const fn = progressOf.toString();
    // G01-1: the status line mid-scramble, the headline just starting to rise.
    await until(page, (f) => {
      const p = new Function(`return (${f})`)()("[data-status] span");
      const s = document.querySelector("[data-status]");
      return !!s && Number(getComputedStyle(s).opacity) > 0.8 && p > 0.3 && p < 0.6;
    }, fn);
    await freeze(page);
    await remeasure(page);
    const heroCopy = await shot(page, "G01-1", "[data-copy]", { pad: 28, top: 64, aspect: 1.9 });
    await thaw(page);
    // G01-2: the headline's last word halfway out of its line mask.
    await until(page, () => {
      const w = [...document.querySelectorAll("[data-line1] div")].filter((x) => x.children.length === 0);
      if (w.length < 2) return false;
      const y = Number(window.__gsap.getProperty(w[w.length - 1], "yPercent"));
      return y > 30 && y < 65;
    });
    await freeze(page);
    await remeasure(page);
    await shot(page, "G01-2", null, { box: heroCopy });
    await thaw(page);
    // G02: the shuttle in from the right, over the top, down onto the button. Ringed for the photo.
    const shuttleAt = async (file, test) => {
      await until(page, test, undefined, 20000);
      await freeze(page);
      await remeasure(page);
      await ring(page, "[data-shuttle]");
      await shot(page, file, "section", { pad: 0, top: 64 });
      await unring(page);
      await thaw(page);
    };
    await shuttleAt("G02-1", () => {
      const s = document.querySelector("[data-shuttle]");
      if (!s || getComputedStyle(s).visibility !== "visible") return false;
      const r = s.getBoundingClientRect();
      return r.right < innerWidth - 24 && r.left > innerWidth * 0.66;
    });
    await shuttleAt("G02-2", () => {
      const s = document.querySelector("[data-shuttle]");
      if (!s || getComputedStyle(s).visibility !== "visible") return false;
      const r = s.getBoundingClientRect();
      return r.left > innerWidth * 0.4 && r.left < innerWidth * 0.56;
    });
    await shuttleAt("G02-3", () => {
      const s = document.querySelector("[data-shuttle]");
      const b = document.querySelector("[data-cta] > :first-child");
      if (!s || !b || getComputedStyle(s).visibility !== "visible" || Number(getComputedStyle(s).opacity) < 0.6) return false;
      const r = s.getBoundingClientRect();
      const q = b.getBoundingClientRect();
      return Math.hypot(r.left + r.width / 2 - (q.left + q.width / 2), r.top + r.height / 2 - q.top) < 90;
    });
    // G01-3: the hero at rest.
    await speed(page, 1);
    await until(page, heroEnded, undefined, 20000);
    await remeasure(page);
    await page.waitForTimeout(600);
    await shot(page, "G01-3", null, { box: heroCopy });

    // G03: the manifesto at three scroll positions (scrubbed, so the scroll decides).
    const manifesto = (s) => s.trigger?.tagName === "P" && s.vars.scrub === 0.6;
    let box = null;
    for (const [n, at] of [[1, 0.12], [2, 0.5], [3, 1]]) {
      await scrollToTrigger(page, manifesto, at);
      await page.waitForTimeout(2000);
      await shot(page, `G03-${n}`, "section[aria-label] p", { pad: 36, top: 64 });
    }
    // G04: "Three steps" at the start, middle and end of its pin.
    const howPin = (s) => s.pin === document.getElementById("how");
    for (const [n, at] of [[1, 0], [2, 0.45], [3, 1]]) {
      await scrollToTrigger(page, howPin, at);
      await page.waitForTimeout(2000);
      await shot(page, `G04-${n}`, ["#how h2", "#how ol"], { pad: 28, top: 64 });
    }
    // G05: the coach filter before, during and after the Flip.
    await page.evaluate(() => {
      const bar = [...document.querySelectorAll("#coaches button")].find((b) => b.textContent.trim() === "Bóng rổ");
      window.scrollTo(0, bar.getBoundingClientRect().top + window.scrollY - 150);
    });
    await page.waitForTimeout(2000);
    await tag(page, () => {
      const bar = [...document.querySelectorAll("#coaches button")].find((b) => b.textContent.trim() === "Bóng rổ");
      bar.closest("[data-rise]")?.setAttribute("data-frame-filter", "");
      document.querySelector("#coaches [data-coach]")?.parentElement?.setAttribute("data-frame-grid", "");
    });
    const coachCrop = ["[data-frame-filter]", "[data-frame-grid]"];
    await shot(page, "G05-1", coachCrop, { pad: 16, top: 64 });
    // Where the basketball coach's card starts and where it will end (the first slot of the grid).
    await page.evaluate(() => {
      const card = [...document.querySelectorAll("#coaches [data-coach]")].find((c) => c.textContent.includes("Bóng rổ"));
      card?.setAttribute("data-frame-mover", "");
      window.__flipFrom = card?.getBoundingClientRect().left ?? 0;
      window.__flipTo = document.querySelector("[data-frame-grid]").getBoundingClientRect().left;
    });
    await speed(page, 0.2);
    await page.locator("#coaches").getByRole("button", { name: "Bóng rổ", exact: true }).click();
    // Caught by where the card actually is: 30-70% of the way to its new place.
    await until(page, () => {
      const c = document.querySelector("[data-frame-mover]");
      if (!c) return false;
      const k = (window.__flipFrom - c.getBoundingClientRect().left) / (window.__flipFrom - window.__flipTo || 1);
      return k > 0.3 && k < 0.7;
    });
    await freeze(page);
    await shot(page, "G05-2", coachCrop, { pad: 16, top: 64 });
    await thaw(page);
    await speed(page, 1);
    await page.waitForTimeout(1500);
    await shot(page, "G05-3", coachCrop, { pad: 16, top: 64 });
    // G06: the facilities ride at the start, middle and end of its pin.
    const facPin = (s) => s.pin === document.getElementById("facilities");
    for (const [n, at] of [[1, 0.04], [2, 0.5], [3, 0.97]]) {
      await scrollToTrigger(page, facPin, at);
      await page.waitForTimeout(2600);
      await shot(page, `G06-${n}`, "#facilities", { pad: 0, top: 64 });
    }
    // G07: the day bar drawing, slowed: off-peak filling, peak filling, done. Park the bar in view at
    // full speed (it plays once and the page settles), then slow down and replay its own timeline,
    // so nothing scrolls while the steps are taken.
    await page.evaluate(() => {
      const d = document.querySelector("[data-day]");
      d.closest("section")?.querySelector("h2")?.setAttribute("data-frame-dayh", "");
      window.scrollTo(0, d.getBoundingClientRect().top + window.scrollY - innerHeight * 0.6);
    });
    await page.waitForTimeout(3500);
    await speed(page, 0.25);
    await page.evaluate(() => {
      window.__ST.getAll().find((t) => t.trigger === document.querySelector("[data-day]"))?.animation?.restart();
    });
    const segAt = (sel, lo, hi) =>
      until(page, ([s, a, b]) => {
        const seg = document.querySelector(s);
        const m = seg && getComputedStyle(seg).transform.match(/matrix\(([^,]+)/);
        const sx = m ? Number(m[1]) : seg ? 1 : 0;
        return sx > a && sx < b;
      }, [sel, lo, hi]);
    await segAt("[data-seg-off]", 0.35, 0.75);
    await freeze(page);
    box = await shot(page, "G07-1", ["[data-frame-dayh]", "[data-day]"], { pad: 24, top: 64 });
    await thaw(page);
    await segAt("[data-seg-peak]", 0.35, 0.75);
    await freeze(page);
    await shot(page, "G07-2", null, { box });
    await thaw(page);
    await speed(page, 1);
    await page.waitForTimeout(3200);
    await shot(page, "G07-3", null, { box });
    await ctx.close();
  }

  // ── G12: "Three steps" with reduced motion (nothing pinned, everything lit), beside the moving one.
  {
    const ctx = await gsapCtx("public", { reduce: true });
    const page = await ctx.newPage();
    // In Vietnamese like every other frame (the language is applied after hydration).
    const vi = () => document.querySelector("#how h2")?.textContent.includes("Ba bước");
    for (let i = 0; i < 2; i++) {
      await page.goto(base + "/", { waitUntil: "networkidle" });
      if (await until(page, vi, undefined, 10000)) break;
    }
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById("how").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(800);
    if (existsSync(`${OUT}/img/G04-2.jpg`)) copyFileSync(`${OUT}/img/G04-2.jpg`, `${OUT}/img/G12-1.jpg`);
    await shot(page, "G12-2", ["#how h2", "#how ol"], { pad: 28 });
    await ctx.close();
  }

  // ── In-app moments (create a hold and a payment): only with MOMENTS=1, on an in-memory database.
  if (process.env.MOMENTS !== "1") {
    console.log("frames G08-G11 skipped: set MOMENTS=1 (and run the app with PGLITE_DATA_DIR=memory)");
    return;
  }
  let ctx = await gsapCtx("member", { dsf: 3, realClock: true });
  let page = await ctx.newPage();
  await page.goto(base + "/app/book", { waitUntil: "networkidle" });
  await arm(page);
  await page.waitForTimeout(2500);
  const fn = progressOf.toString();
  // G08: the sport glyph before, mid-morph and after, with its label and a slice of the photo.
  const glyph = 'main svg[class*="align-[-0.3em]"]';
  await tag(page, (g) => document.querySelector(g)?.parentElement?.setAttribute("data-frame-glyph", ""), glyph);
  let box = await shot(page, "G08-1", "text:[data-frame-glyph]", { pad: 18 });
  await speed(page, 0.25);
  await page.getByRole("button", { name: "Bóng rổ", exact: true }).filter({ visible: true }).first().click();
  await until(page, ([f, g]) => {
    const p = new Function(`return (${f})`)()(g + " path");
    return p > 0.18 && p < 0.32;
  }, [fn, glyph]);
  await freeze(page);
  await shot(page, "G08-2", null, { box });
  await thaw(page);
  await speed(page, 1);
  await page.waitForTimeout(1500);
  await shot(page, "G08-3", null, { box });
  await page.getByRole("button", { name: "Cầu lông", exact: true }).filter({ visible: true }).first().click();
  await page.waitForTimeout(1500);
  // A hold. A member may hold two slots a day and the seed can fill a member's whole week, so try
  // day after day (today at its latest hour, which is still ahead), then other seeded members.
  // All of it on the in-memory database. The plan-hours button only shows with hours left on an active
  // plan, so these are seeded members whose plan has court hours and who have days under the cap.
  const members = ["0901230120", "0901230131", "0901230143", "0901230119", "0901230132", "0901230111", "0901230117", "0901230138"];
  const tryHold = async (pg) => {
    const days = pg.locator("main button:has(span.text-2xs)");
    for (let d = 0; d <= 6; d++) {
      await speed(pg, 1);
      await days.nth(d).click();
      await pg.waitForTimeout(1600);
      await speed(pg, 0.25);
      const cells = pg.locator('main button[aria-label^="Đặt "]').filter({ visible: true });
      if (!(await cells.count())) continue;
      await (d === 0 ? cells.last() : cells.first()).click();
      await pg.waitForTimeout(400);
      const plan = pg.getByRole("button", { name: /^Dùng giờ trong gói/ });
      if ((await plan.isVisible()) || (await pg.waitForTimeout(900), await plan.isVisible())) return true;
      await pg.getByRole("button", { name: "Bỏ qua" }).first().click().catch(() => undefined);
    }
    return false;
  };
  const openAs = async (phone) => {
    await ctx.close();
    ctx = await gsapCtx("member", { dsf: 3, realClock: true, session: await login(phone) });
    page = await ctx.newPage();
    await page.goto(base + "/app/book", { waitUntil: "networkidle" });
    await arm(page);
    await page.waitForTimeout(2000);
  };
  let held = await tryHold(page);
  while (!held && members.length) {
    const phone = members.shift();
    console.log("hold: trying member", phone);
    await openAs(phone);
    held = await tryHold(page);
  }
  if (!held) {
    console.log("frames G09-G11 skipped: no member with room for a hold");
    await ctx.close();
    return;
  }
  // The countdown block and the line under it (court, code, price).
  await tag(page, () => {
    const hc = document.querySelector("[data-dial]")?.parentElement;
    hc?.setAttribute("data-frame-hc", "");
    hc?.nextElementSibling?.setAttribute("data-frame-code", "");
  });
  const hold = ["text:[data-frame-hc]", "text:[data-frame-code]"];
  // G09-1: the code mid-decode (a quarter-speed second, so about four real seconds).
  await until(page, (f) => {
    const p = new Function(`return (${f})`)()("[data-frame-code] .text-subtle");
    return p > 0.35 && p < 0.6;
  }, fn);
  await freeze(page);
  box = await shot(page, "G09-1", hold, { pad: 14 });
  await thaw(page);
  await speed(page, 1);
  await page.waitForTimeout(2500);
  await shot(page, "G09-2", null, { box });
  // Jump the clock to two and a half minutes left: the ring has drained past half.
  const secsLeft = () => {
    const [m, s] = (document.querySelector("[role=timer]")?.textContent ?? "0:00").split(":").map(Number);
    return m * 60 + s;
  };
  const leaveOnly = async (secs) => {
    const left = await page.evaluate(secsLeft);
    await page.evaluate((ms) => window.__shift(ms), (left - secs) * 1000);
  };
  await leaveOnly(150);
  await page.waitForTimeout(1500);
  await shot(page, "G09-3", null, { box });
  // G10: just over a minute, then the 60-second mark (red, one shake, slowed), then after it.
  await leaveOnly(63);
  await page.waitForTimeout(1200);
  await shot(page, "G10-1", null, { box });
  await speed(page, 0.25);
  await until(page, () => {
    const d = document.querySelector("[data-dial]");
    return !!d && Math.abs(window.__gsap.getProperty(d, "rotation")) > 4;
  }, undefined, 12000);
  await freeze(page);
  await shot(page, "G10-2", null, { box });
  await thaw(page);
  await speed(page, 1);
  await page.waitForTimeout(1500);
  await shot(page, "G10-3", null, { box });
  // G11: pay with plan hours, slowed: the ring drawing, the burst, the mark at rest. A plan can be
  // out of court hours; then hold again as the next member and pay straight away.
  const pay = async () => {
    await speed(page, 0.25);
    await page.getByRole("button", { name: /^Dùng giờ trong gói/ }).click();
    return !!(await until(page, () => !!document.querySelector("[data-dot]"), undefined, 8000));
  };
  let paid = await pay();
  while (!paid && members.length) {
    const phone = members.shift();
    console.log("pay: trying member", phone);
    await openAs(phone);
    if (await tryHold(page)) paid = await pay();
  }
  if (!paid) {
    console.log("frame G11 skipped: no member with plan hours left");
    await ctx.close();
    return;
  }
  // The mark with the receipt line beside it (its title and subline), measured as text so nothing is cut.
  await tag(page, () => {
    const mark = document.querySelector("[data-dot]")?.parentElement;
    mark?.setAttribute("data-frame-paid", "");
    const ps = mark?.nextElementSibling?.querySelectorAll("p") ?? [];
    ps[0]?.setAttribute("data-frame-paidtitle", "");
    ps[1]?.setAttribute("data-frame-paidsub", "");
  });
  await until(page, (f) => {
    const p = new Function(`return (${f})`)()("[data-frame-paid] [data-ring]");
    return p > 0.3 && p < 0.5;
  }, fn);
  await freeze(page);
  box = await shot(page, "G11-1", ["[data-frame-paid]", "text:[data-frame-paidtitle]", "text:[data-frame-paidsub]"], { pad: 30 });
  await thaw(page);
  await until(page, (f) => {
    const p = new Function(`return (${f})`)()("[data-frame-paid] [data-dot]");
    return p > 0.22 && p < 0.36;
  }, fn);
  await freeze(page);
  await shot(page, "G11-2", null, { box });
  await thaw(page);
  await speed(page, 1);
  await page.waitForTimeout(1800);
  await shot(page, "G11-3", null, { box });
  await ctx.close();
}

// ONLY=S32,S05 reshoots just those screens and keeps every other image; add MORE for the menus.
const only = process.env.ONLY ? process.env.ONLY.split(",").map((x) => x.trim()) : null;
if (!noShoot) {
  if (!only) marksFound = {};
  const browser = await chromium.launch({ channel: "chrome" });
  for (const [vpName, size] of Object.entries(VP)) {
    for (const role of Object.keys(ROLES)) {
      if (only && !S.some((r, i) => r[0] === role && only.includes(idOf(i)))) continue;
      const ctx = await ctxFor(browser, size, role);
      const page = await ctx.newPage();
      for (const [i, row] of S.entries()) {
        if (row[0] !== role) continue;
        if (only && !only.includes(idOf(i))) continue;
        await settle(page, row[1].replace("$ID", demoId));
        if (row[10]) {
          // A filter that changes what is shown, not what is stored (e.g. a report period).
          await page.getByRole("button", { name: row[10], exact: true }).first().click({ timeout: 4000 }).catch(() => undefined);
          await page.waitForTimeout(1500);
        }
        const labels = row[6].map((a) => a.mark ?? null);
        marksFound[`${idOf(i)}-${vpName}`] = await page.evaluate(`(${drawMarks.toString()})(${JSON.stringify(labels)})`);
        await page.screenshot({ path: `${OUT}/img/${idOf(i)}-${vpName}.jpg`, type: "jpeg", quality: 84 });
        await page.evaluate(() => document.querySelectorAll("[data-mark]").forEach((n) => n.remove()));
        if (vpName === "d" && row[8]) {
          if (typeof row[9] === "string" && row[9].startsWith("/")) {
            // Another page that belongs with this one (read-only navigation).
            await settle(page, row[9]);
          } else if (typeof row[9] === "string") {
            // A section further down (read-only scroll, no clicks).
            await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "start" }), row[9]);
          } else if (row[9] != null) {
            // Opening a tab changes what is shown, not what is stored.
            const tabs = page.getByRole("tab");
            if ((await tabs.count()) > row[9]) await tabs.nth(row[9]).click({ timeout: 4000 }).catch(() => undefined);
            else await page.getByRole("button", { name: new RegExp(`^${row[9] + 1}\\b`) }).first().click({ timeout: 4000 }).catch(() => undefined);
          } else {
            // The part below the first screen (read-only scroll, no clicks).
            await page.evaluate(() => window.scrollTo(0, Math.min(document.body.scrollHeight, window.innerHeight * 1.05)));
          }
          await page.waitForTimeout(900);
          await page.screenshot({ path: `${OUT}/img/${idOf(i)}-x.jpg`, type: "jpeg", quality: 84 });
        }
        console.log("shot", idOf(i), vpName, row[1]);
      }
      await ctx.close();
    }
  }
  // The "More" menus (opening a menu changes no data).
  for (const role of only && !only.includes("MORE") ? [] : ["member", "receptionist", "manager"]) {
    for (const [vpName, size] of Object.entries(VP)) {
      if (role === "member" && vpName === "d") continue;
      const ctx = await ctxFor(browser, size, role);
      const page = await ctx.newPage();
      await settle(page, role === "manager" ? "/manager" : role === "member" ? "/app" : "/desk");
      try {
        // The visible one: on a computer the phone's bottom-bar button is in the page but hidden.
        await page.getByRole("button", { name: /Thêm/ }).filter({ visible: true }).first().click({ timeout: 4000 });
        await page.waitForTimeout(900);
      } catch {
        console.log("no More button", role, vpName);
      }
      await page.screenshot({ path: `${OUT}/img/MORE-${role}-${vpName}.jpg`, type: "jpeg", quality: 84 });
      await ctx.close();
    }
  }
  if (!only || only.includes("GSAP")) await shootGsapFrames(browser);
  await browser.close();
  writeFileSync(marksFile, JSON.stringify(marksFound, null, 1));
}

const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const codeOf = (route) => idOf(S.findIndex((r) => r[1] === route));
// ==word== becomes a highlighter mark, @[/route] that screen's code (a link).
const rich = (x) =>
  esc(x)
    .replace(/==(.+?)==/g, "<mark>$1</mark>")
    .replace(/@\[(.+?)\]/g, (_, r) => `<a class="scr" href="#${codeOf(r)}">${codeOf(r)}</a>`);
const byRole = Object.keys(ROLES).map((k) => ({ k, rows: S.map((r, i) => ({ r, i })).filter((x) => x.r[0] === k) }));
const reachOf = (r) => (typeof r[3] === "string" ? { d: r[3], m: r[3] } : reach(r[3]));
const roleChip = (k) => `<span class="role" style="color:${ROLES[k].color};border-color:${ROLES[k].color}">${ROLES[k].vn}</span>`;
// Screen codes as chips; plain spans where the chips sit inside a link (a link cannot hold another).
const scrChips = (routes, max = 7, link = true) =>
  routes.length > max
    ? `<span class="scr many">${routes.length} màn</span>`
    : routes.map((r) => (link ? `<a class="scr" href="#${codeOf(r)}">${codeOf(r)}</a>` : `<span class="scr">${codeOf(r)}</span>`)).join(" ");

// Which changes touch a screen, and which screens are new.
const NEW_SCREENS = ["/terms"];
const changesOf = (route) => {
  const small = SMALL.filter((s) => s[2].includes(route));
  return [
    ...CHANGES.filter((c) => c.screens.includes(route)).map((c) => ({ id: c.id, title: c.title })),
    ...(small.length ? [{ id: "C10", title: small.length > 1 ? `${small.length} sửa nhỏ` : small[0][1] }] : []),
  ];
};
const badges = (route) =>
  (NEW_SCREENS.includes(route) ? `<span class="badge new">MỚI</span>` : "") +
  (changesOf(route).length && !NEW_SCREENS.includes(route) ? `<span class="badge chg">ĐÃ ĐỔI</span>` : "") +
  (route === "/app/book" ? `<span class="badge proto">CÓ BẢN THỬ</span>` : "");
const head = (k, code, title, small = "", extra = "") =>
  `<header><span class="code" style="background:${ROLES[k]?.color ?? "#0b1230"}">${code}</span><div class="titles"><h2>${rich(title)}${small ? ` <small>${small}</small>` : ""}</h2></div><div class="meta">${extra}${ROLES[k] ? roleChip(k) : ""}</div></header>`;

// Numbers only for controls that are really visible on the shot.
const actionsHtml = (i, r) => {
  const fd = marksFound[`${idOf(i)}-d`] ?? [];
  return r[6].map((a, k) => `<li>${fd[k] ? `<b class="num">${fd[k]}</b>` : `<b class="dot"></b>`}<span>${rich(a.t)}</span></li>`).join("");
};

const index =
  byRole
    .map(
      ({ k, rows }) =>
        `<div class="idx-role"><h3 style="color:${ROLES[k].color}">${ROLES[k].vn}</h3><ul>${rows
          .map(({ r, i }) => `<li><a href="#${idOf(i)}"><b>${idOf(i)}</b> ${esc(r[2])}${NEW_SCREENS.includes(r[1]) ? ` <i class="tiny new">mới</i>` : changesOf(r[1]).length ? ` <i class="tiny chg">đã đổi</i>` : ""}</a></li>`)
          .join("")}</ul></div>`,
    )
    .join("") +
  `<div class="idx-role"><h3>Những gì đã thay đổi</h3><ul>${CHANGES.map((c) => `<li><a href="#${c.id}"><b>${c.id}</b> ${rich(c.title)}</a></li>`).join("")}<li><a href="#C10"><b>C10</b> Sửa nhỏ</a></li><li><a href="#C11"><b>C11</b> Bản thử chờ duyệt</a></li></ul></div>` +
  `<div class="idx-role"><h3>Trang hướng dẫn</h3><ul><li>Từ khó hiểu</li><li>Đọc lưới sân</li><li>Một ngày của từng vai</li><li>G1-G2 Hiệu ứng GSAP</li><li>G3-G6 Khung hình GSAP</li><li>Menu «Thêm»</li><li>Phụ lục kỹ thuật</li></ul></div>`;

const mkPage = (i, r) => {
  const k = r[0];
  const rc = reachOf(r);
  const reachHtml = rc.d === rc.m ? `<p class="from">${rich(rc.d)}</p>` : `<p class="from"><b>Máy tính:</b> ${rich(rc.d)}<br><b>Điện thoại:</b> ${rich(rc.m)}</p>`;
  const chg = changesOf(r[1]);
  const fx = FX_CHIPS[r[1]] ? `<p class="fxline">Hiệu ứng: ${FX_CHIPS[r[1]].map((c) => `<span class="chip">${c}</span>`).join("")} <a href="#G1">→ G1</a></p>` : "";
  const third = chg.length
    ? `<div class="chgbox"><h4>Đã đổi ở màn này</h4><ul>${chg.map((c) => `<li><a href="#${c.id}"><b class="cid">${c.id}</b> ${rich(c.title)}</a></li>`).join("")}${r[1] === "/app/book" ? `<li><a href="#C11"><b class="cid proto">C11</b> Bản thử: đặt theo giờ trước</a></li>` : ""}</ul></div>`
    : `<div>${r[7] ? `<h4>Lưu ý</h4><p class="note">${rich(r[7])}</p>` : ""}</div>`;
  const first = `
<section class="page" id="${idOf(i)}">
  ${head(k, idOf(i), r[2], "", badges(r[1]))}
  <p class="lead">${rich(r[4])}</p>
  <div class="shots">
    <figure class="desk"><img src="img/${idOf(i)}-d.jpg" alt=""><figcaption>Máy tính</figcaption></figure>
    <figure class="mob"><img src="img/${idOf(i)}-m.jpg" alt=""><figcaption>Điện thoại</figcaption></figure>
  </div>
  <div class="info">
    <div><h4>Bấm gì</h4><ul class="acts">${actionsHtml(i, r)}</ul></div>
    <div><h4>Ai dùng, vào bằng đâu</h4><p>${rich(r[5])}</p>${reachHtml}${chg.length && r[7] ? `<p class="note">${rich(r[7])}</p>` : ""}${fx}</div>
    ${third}
  </div>
</section>`;
  const more = r[8]
    ? `
<section class="page" id="${idOf(i)}x">
  ${head(k, idOf(i), r[2], "(trang tiếp)")}
  <div class="shots"><figure class="desk wide"><img src="img/${idOf(i)}-x.jpg" alt=""><figcaption>${esc(r[8])}</figcaption></figure></div>
</section>`
    : "";
  return first + more;
};
const pages = byRole.flatMap(({ rows }) => rows.map(({ r, i }) => mkPage(i, r))).join("\n");

// ── What changed
const TAG = { b: ["TRƯỚC", "tb"], a: ["BÂY GIỜ", "ta"], new: ["MỚI", "tn"] };
const chgImg = (s) => `img/changes/${s.img}.jpg`;
const changeCards =
  CHANGES.map(
    (c) => `<a class="cc" href="#${c.id}"><b class="cn">${c.id}</b><div><strong>${rich(c.title)}</strong><p><span class="tb">Trước</span> ${rich(c.before)}</p><p><span class="ta">Bây giờ</span> ${rich(c.after)}</p><p class="on">Ở màn: ${scrChips(c.screens, 7, false)}</p></div></a>`,
  ).join("") +
  `<a class="cc" href="#C10"><b class="cn">C10</b><div><strong>${SMALL.length} sửa nhỏ</strong>${SMALL.slice(0, 3).map(([, a]) => `<p><span class="ta">Bây giờ</span> ${rich(a)}</p>`).join("")}</div></a>` +
  `<a class="cc proto" href="#C11"><b class="cn">C11</b><div><strong>${rich(PROTO.title)}</strong><p><span class="tp">Chờ duyệt</span> ${rich("Mở Đặt sân là thấy ==dãy giờ== trước, chọn giờ rồi mới chọn sân.")}</p></div></a>`;
const changesOverview = `
<section class="page idx" id="CHG">
  <h2>Những gì đã thay đổi <small>so với bản trước (main, 13/10/2026)</small></h2>
  <p class="lead small-lead">${rich(`${CHANGES.length} thay đổi lớn, ${SMALL.length} sửa nhỏ, 1 bản thử đang chờ duyệt. Bấm vào một thẻ để xem ảnh ==Trước== và ==Bây giờ==. Trên từng màn hình, nhãn`)} <span class="badge chg">ĐÃ ĐỔI</span> ${rich("cho biết màn đó có thay đổi.")}</p>
  <div class="chg-grid">${changeCards}</div>
</section>`;
const changePage = (c) => {
  const figs = c.shots
    .map((s) => `<figure class="cf ${TAG[s.tag][1]}"><span class="tag ${TAG[s.tag][1]}">${TAG[s.tag][0]}</span><div class="im"><img src="${chgImg(s)}" alt=""></div>${s.cap ? `<figcaption>${rich(s.cap)}</figcaption>` : ""}</figure>`)
    .join("");
  const n = c.shots.length;
  const style = c.grid
    ? c.grid
    : c.layout === "stack" ? `grid-template-rows:repeat(${n},minmax(0,1fr))` : c.layout === "grid" ? "grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr) minmax(0,1.6fr)" : `grid-template-columns:repeat(${n},minmax(0,1fr));grid-template-rows:minmax(0,1fr)`;
  return `
<section class="page chgp" id="${c.id}">
  <header><span class="code" style="background:#0b1230">${c.id}</span><div class="titles"><h2>${rich(c.title)}</h2></div><div class="meta on">Ở màn: ${scrChips(c.screens, 15)}</div></header>
  <div class="ba"><p><span class="tb">Trước</span>${rich(c.before)}</p><p><span class="ta">Bây giờ</span>${rich(c.after)}</p></div>
  <div class="cshots" style="${style}">${figs}</div>
  <p class="why"><b>Vì sao:</b> ${rich(c.why)}</p>
</section>`;
};
const smallPage = `
<section class="page chgp" id="C10">
  <header><span class="code" style="background:#0b1230">C10</span><div class="titles"><h2>Sửa nhỏ</h2></div></header>
  <table class="small">${SMALL.map(([b, a, scr]) => `<tr><td><span class="tb">Trước</span> ${rich(b)}</td><td class="arrow">→</td><td><span class="ta">Bây giờ</span> ${rich(a)}</td><td class="on">${scrChips(scr)}</td></tr>`).join("")}</table>
  <div class="cshots" style="grid-template-rows:minmax(0,1fr) minmax(0,1fr)">
    <figure class="cf tb"><span class="tag tb">TRƯỚC</span><div class="im"><img src="img/changes/C-plan-b.jpg" alt=""></div><figcaption>${rich("==Holding your court== còn tiếng Anh.")}</figcaption></figure>
    <figure class="cf ta"><span class="tag ta">BÂY GIỜ</span><div class="im"><img src="img/changes/C-plan-a.jpg" alt=""></div><figcaption>${rich("==Đang giữ sân cho bạn==, kèm vòng đếm ngược.")}</figcaption></figure>
  </div>
</section>`;
const protoPage = `
<section class="page chgp" id="C11">
  <header><span class="code" style="background:#9a5200">C11</span><div class="titles"><h2>${rich(PROTO.title)}</h2></div><div class="meta"><span class="badge proto">${esc(PROTO.status)}</span></div></header>
  <p class="lead">${rich(PROTO.what)}</p>
  <div class="cshots" style="grid-template-columns:1fr 1fr 2.3fr;grid-template-rows:minmax(0,1fr)">${PROTO.shots
    .map(([f, cap]) => `<figure class="cf tp"><span class="tag tp">BẢN THỬ</span><div class="im"><img src="img/changes/proto/${f}.jpg" alt=""></div><figcaption>${esc(cap)}</figcaption></figure>`)
    .join("")}</div>
  <p class="why"><b>Cần quyết:</b> ${rich("Duyệt cách này thì làm tiếp ==mã khuyến mãi ngay trên thẻ giữ chỗ== rồi đưa vào bản chính.")}</p>
</section>`;
const changesPart = changesOverview + CHANGES.map(changePage).join("") + smallPage + protoPage;

const moreMenus = `
<section class="page" id="MORE">
  ${head("", "+", "Menu «Thêm»")}
  <p class="lead">${rich("Thanh dưới trên điện thoại chỉ giữ ==5 mục dùng nhiều nhất==. Các mục còn lại nằm trong nút ==Thêm==.")}</p>
  <div class="shots">
    <figure class="mob"><img src="img/MORE-member-m.jpg" alt=""><figcaption>Hội viên, điện thoại</figcaption></figure>
    <figure class="mob"><img src="img/MORE-receptionist-m.jpg" alt=""><figcaption>Lễ tân, điện thoại</figcaption></figure>
    <figure class="mob"><img src="img/MORE-manager-m.jpg" alt=""><figcaption>Quản lý, điện thoại</figcaption></figure>
    <figure class="desk narrow"><img src="img/MORE-manager-d.jpg" alt=""><figcaption>Quản lý, máy tính</figcaption></figure>
  </div>
  <div class="info two">
    <div><h4>Quản lý: ba nhóm</h4><p>${rich("==Kinh doanh==, ==Vận hành==, ==Hệ thống==.")}</p></div>
    <div><h4>Mục nào nằm trong «Thêm»</h4><ul class="acts">
      <li><b class="dot"></b><span>${rich("==Hội viên:== Tiến độ, Gói tập, Điểm")}</span></li>
      <li><b class="dot"></b><span>${rich("==Lễ tân:== Sắp rời bỏ, Lớp học, Dụng cụ, Bảo trì (điện thoại thêm Vé ngày, Đặt cố định)")}</span></li>
      <li><b class="dot"></b><span>${rich("==Quản lý:== Gói tập, Khuyến mãi, Bảng giá, Hoa hồng, Hoá đơn điện tử, Đặt cố định, Vé ngày, Bảo trì, Nhật ký, Cài đặt")}</span></li>
    </ul></div>
  </div>
</section>`;

const GLOSS = [
  ["Giữ sân", "Chạm một giờ trống thì sân được ==giữ riêng cho bạn== vài phút (mặc định 5) để trả tiền. Hết giờ chưa trả thì sân ==trả lại== cho người khác."],
  ["Giờ còn trống (điện thoại)", "Dải giờ trên lưới sân: chạm một giờ là hệ thống ==tự chọn một sân trống==."],
  ["Đã đủ lượt", "Mỗi ngày một hội viên giữ tối đa ==2 lượt==. Dải ngày ghi rõ ngày nào bạn ==đã đủ==."],
  ["Mã QR vào cổng", "Mã trên điện thoại hội viên, ==tự đổi mỗi phút==. Chụp màn hình cũng không dùng lại được."],
  ["Mở ca", "Lễ tân ==mở ca== (như mở két) trước khi thu tiền, ==đóng ca== để đối chiếu. Chưa mở ca thì không thu được."],
  ["Đối soát chuyển khoản", "Kiểm tra tiền khách chuyển ==đã vào tài khoản== trung tâm chưa."],
  ["Mã VietQR", "Mã QR chuẩn của ngân hàng Việt Nam: quét bằng app ngân hàng là ==điền sẵn tài khoản, số tiền, nội dung==."],
  ["Phân trang", "Danh sách dài chia thành ==trang==; tự chọn ==số dòng mỗi trang== và nhảy tới trang bất kỳ."],
  ["Hoàn tiền chờ quản lý", "Hoàn tiền ==vượt hạn mức== phải được quản lý đồng ý."],
  ["Vé ngày", "Vé vào cửa ==một ngày== cho khách lẻ không có gói."],
  ["Đặt sân cố định", "==Cùng sân, cùng giờ, mỗi tuần==, trả trước 4 đến 12 tuần, được giảm giá."],
  ["Danh sách chờ", "Lớp đầy thì ==xếp hàng chờ==; có người rời lớp thì người đầu hàng được mời."],
  ["Sắp rời bỏ", "Hội viên ==vắng liên tiếp== hoặc ==lâu không đến==; nhân viên gọi nhắc."],
  ["Điểm thưởng", "Chi 10.000đ được ==1 điểm==, 1 điểm trị giá ==100đ==, đổi thành mã giảm giá."],
  ["Nhật ký thao tác", "Sổ tự ghi ==ai làm gì, lúc nào==, kèm trước và sau. Không ai sửa hay xoá được."],
];
const glossary = `
<section class="page idx" id="GLOSS">
  <h2>Từ khó hiểu, giải thích một lần</h2>
  <dl class="gloss">${GLOSS.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${rich(d)}</dd></div>`).join("")}</dl>
</section>`;

// The court grid key, drawn with the same colours the app uses.
const STRIPES = "repeating-linear-gradient(45deg,rgba(11,18,48,.12) 0 3px,transparent 3px 7px)";
const SW = [
  ["free", "Trống", "Viền xanh, dấu +. ==Bấm được==.", "background:#ffffff;box-shadow:inset 0 0 0 1px rgba(30,79,216,.45);color:#1e4fd8", "+"],
  ["hold", "Đang giữ chỗ", "Có người ==đang giữ== để trả tiền. Viền vàng đứt nét: tự hết.", `background:${STRIPES},rgba(154,82,0,.15);border:1px dashed #9a5200`, ""],
  ["booked", "Đã đặt", "==Đã có người đặt==. Nền xanh nhạt.", "background:rgba(30,79,216,.15)", ""],
  ["in_use", "Đang dùng", "Có người ==đang chơi== đúng giờ này.", "background:#15348f", ""],
  ["class", "Lớp", "Giờ của ==một lớp== có huấn luyện viên.", "background:#0b1230", ""],
  ["maintenance", "Bảo trì", "Sân ==đang sửa==, không bán.", `background:${STRIPES},#e8edf9`, ""],
  ["closed", "Đã đóng", "Sân ==tạm đóng==, không bán.", `background:${STRIPES},rgba(188,198,224,.45)`, ""],
  ["past", "Đã qua", "Giờ ==đã bắt đầu hoặc đã hết==. Hội viên thấy thu gọn; nhân viên thấy đủ.", "background:rgba(232,237,249,.5)", ""],
];
const gridKey = `
<section class="page idx" id="GRID">
  <h2>Đọc lưới sân</h2>
  <p class="lead">${rich(`Lưới sân có ở @[/], @[/app/book] và @[/desk/courts]. ==Mỗi hàng là một giờ, mỗi cột là một sân==. Cả ba nơi dùng chung màu.`)}</p>
  <div class="key">${SW.map(([, name, what, style, glyph]) => `<div class="kc"><span class="sw" style="${style}">${glyph}</span><div><strong>${name}</strong><span>${rich(what)}</span></div></div>`).join("")}</div>
  <p class="lead small">${rich("Trên điện thoại, lưới thành ==thẻ sân vuốt ngang==, phía trên có dải ==Giờ còn trống==.")}</p>
</section>`;

const dayPage = (k, title, steps) => `
<section class="page idx day">
  ${head(k, "▶", `Một ngày của ${title}`)}
  <ol class="flow">${steps.map(([route, name, what]) => `<li><a href="#${codeOf(route)}"><b>${codeOf(route)}</b></a><div><strong>${esc(name)}</strong><span>${rich(what)}</span></div></li>`).join("")}</ol>
</section>`;
const days = [
  dayPage("member", "hội viên", [["/app", "Trang chủ hội viên", "Xem ==lịch hôm nay== và gói đang dùng"], ["/app/book", "Đặt sân", "Chạm giờ trống, ==giữ sân==, trả tiền"], ["/app/pass", "Mã QR vào cổng", "Đến nơi, đưa ==mã QR== cho lễ tân"], ["/app/classes", "Lớp học", "Đăng ký ==lớp có huấn luyện viên=="], ["/app/train", "Tiến độ", "Làm ==bài tập==, đọc ==nhận xét=="]]),
  dayPage("receptionist", "lễ tân", [["/desk", "Quầy", "==Mở ca==, xem ==Ngay lúc này==, tìm hội viên"], ["/desk/gate", "Cổng", "==Quét QR== cho khách vào"], ["/desk/courts", "Sơ đồ sân", "Bán ==giờ trống== cho khách vãng lai"], ["/desk/payments", "Thanh toán", "==Thu tiền==, ==đối soát chuyển khoản=="], ["/desk/at-risk", "Sắp rời bỏ", "==Gọi nhắc== hội viên lâu không đến"]]),
  dayPage("coach", "huấn luyện viên", [["/coach", "Lịch dạy", "Xem ==buổi tiếp theo=="], ["/coach/attendance", "Điểm danh", "==Điểm danh==, lưu sổ, lên ==giáo án=="], ["/coach/student/$ID", "Hồ sơ học viên", "Xem ==ghi chú sức khoẻ==, nhận xét"], ["/coach/earnings", "Thu nhập", "Đối chiếu ==buổi đã dạy=="]]),
  dayPage("manager", "quản lý", [["/manager", "Báo cáo", "Xem ==doanh thu==, ==công suất sân==, xuất file"], ["/manager/attendance", "Điểm danh", "Xem ai ==thực sự đến tập=="], ["/manager/plans", "Gói tập", "Tạo, sửa ==gói đang bán=="], ["/manager/staff", "Nhân viên", "==Cấp tài khoản== nhân viên"], ["/manager/audit", "Nhật ký thao tác", "Kiểm tra ==ai đã làm gì=="]]),
].join("");

const fxTable = (rows) =>
  `<table class="fxt"><tr><th>Hiệu ứng</th><th>Ở màn</th><th>Nói lên điều gì</th></tr>${rows
    .map(([name, tools, routes, meaning]) => `<tr><td><b>${esc(name)}</b><br><code>${esc(tools)}</code></td><td>${routes.map((r) => `<a class="scr" href="#${codeOf(r)}">${codeOf(r)}</a>`).join(" ")}</td><td>${rich(meaning)}</td></tr>`)
    .join("")}</table>`;
const gsapPages = `
<section class="page idx" id="G1">
  ${head("", "G1", "Hiệu ứng GSAP: trang chủ")}
  <p class="lead">${rich("Mỗi hiệu ứng chỉ vào ==một thông tin thật== (giờ trống, giá, thời gian giữ, tiền đã nhận). ==Không có hiệu ứng nào trên ô lưới sân==. Máy bật ==giảm chuyển động== thì tắt hết, nội dung hiện sẵn.")}</p>
  ${fxTable(FX_LANDING)}
</section>
<section class="page idx" id="G2">
  ${head("", "G2", "Hiệu ứng GSAP: trong ứng dụng")}
  <p class="lead">${rich("Trong ứng dụng, GSAP chỉ lo ==những khoảnh khắc==: thời gian giữ đang trôi, mã vừa cấp, tiền vừa nhận.")}</p>
  ${fxTable(FX_APP)}
  <div class="howgrid">
    <div><h4>Một nhịp chung</h4><p>${rich("Mọi hiệu ứng dùng chung đường cong tốc độ ==arena==, nên ăn khớp với nhau.")}</p></div>
    <div><h4>Tắt là tắt hẳn</h4><p>${rich("Giảm chuyển động thì ==không tạo gì cả==; giao diện vốn ở trạng thái cuối.")}</p></div>
    <div><h4>Mã nguồn</h4><p><code>src/lib/gsap.ts</code>, <code>src/components/landing/*</code>, <code>src/components/moments/*</code></p></div>
  </div>
</section>
${[0, 3, 6, 9]
  .map((at, gi) => {
    const rows = FRAMES.slice(at, at + 3)
      .map(([id, title, tools, route, cap, labels]) => {
        const steps = labels
          .map((label, i) => [`${id}-${i + 1}`, label, i + 1])
          .filter(([file]) => existsSync(`${OUT}/img/${file}.jpg`));
        if (!steps.length) return "";
        return `<figure class="fr"><figcaption><b class="frt">${id} · ${esc(title)}</b> <span class="chip">${esc(tools)}</span> <a class="scr" href="#${codeOf(route)}">${codeOf(route)}</a> <span class="frc">${rich(cap)}</span></figcaption><div class="steps">${steps
          .map(([file, label, n]) => `<div class="st"><div class="sti"><img src="img/${file}.jpg" alt=""></div><span class="stl"><i>${n}</i>${esc(label)}</span></div>`)
          .join("")}</div></figure>`;
      })
      .join("");
    return `
<section class="page idx" id="G${gi + 3}">
  ${head("", `G${gi + 3}`, `Khung hình GSAP, từng bước (${gi + 1}/4)`)}
  <div class="frows">${rows}</div>
</section>`;
  })
  .join("")}`;

// Two tables side by side, so every row fits on one A4 page.
const appRows = S.map((r, i) => `<tr><td>${idOf(i)}</td><td>${esc(r[2])}</td><td>${ROLES[r[0]].vn}</td><td><code>${esc(r[1].replace("$ID", "{id}"))}</code></td></tr>`);
const half = Math.ceil(appRows.length / 2);
const appTable = (rows) => `<table class="app"><tr><th>Mã</th><th>Tên màn hình</th><th>Vai trò</th><th>Đường dẫn</th></tr>${rows.join("")}</table>`;
const appendix = `
<section class="page idx">
  <h2>Phụ lục kỹ thuật (cho người làm phần mềm)</h2>
  <div class="app-cols">${appTable(appRows.slice(0, half))}${appTable(appRows.slice(half))}</div>
  <p class="lead small">Ảnh màn hình: <code>node scripts/screen-dictionary.mjs</code>. Ảnh trước / sau: <code>node scripts/screen-dictionary-changes.mjs</code> (bản trước chạy ở BEFORE, bản này ở AFTER, cả hai với PGLITE_DATA_DIR=memory).</p>
</section>`;

const changedCount = S.filter((r) => changesOf(r[1]).length).length;
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Arena3: Từ điển màn hình</title>
<link rel="stylesheet" href="../../node_modules/@fontsource/be-vietnam-pro/400.css">
<link rel="stylesheet" href="../../node_modules/@fontsource/be-vietnam-pro/600.css">
<link rel="stylesheet" href="../../node_modules/@fontsource/be-vietnam-pro/700.css">
<style>
@page { size: A4 landscape; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif; color: #0b1230; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact }
a { color: inherit; text-decoration: none }
mark { background: #ffec7a; color: #0b1230; padding: 0 .5mm; border-radius: .8mm; font-weight: 600; box-decoration-break: clone; -webkit-box-decoration-break: clone }
.page { width: 297mm; height: 210mm; padding: 9mm 11mm; page-break-after: always; display: flex; flex-direction: column; gap: 3.5mm; overflow: hidden; background: #f4f6fc }
.cover { justify-content: center; padding: 18mm 22mm; background: #0b1230; color: #f4f6fc; gap: 0 }
.cover .brand { display: flex; align-items: center; gap: 4mm; margin-bottom: 8mm; font-size: 14pt; font-weight: 700 }
.cover .brand i { width: 11mm; height: 11mm; border-radius: 2.5mm; background: #1e4fd8; display: inline-block }
.cover h1 { font-size: 38pt; margin: 0 0 6mm; font-weight: 700; letter-spacing: -.5px; line-height: 1.1 }
.cover p { font-size: 14pt; max-width: 215mm; line-height: 1.55; margin: 0 0 3mm; color: #c9d2e6 }
.cover .read { display: flex; gap: 6mm; margin-top: 7mm; flex-wrap: wrap; font-size: 11pt; color: #f4f6fc; align-items: center }
.cover .read span { display: inline-flex; gap: 2mm; align-items: center }
.cover .stats { display: flex; gap: 10mm; margin-top: 8mm }
.cover .stats div { font-size: 10pt; color: #c9d2e6 } .cover .stats b { display: block; font-size: 26pt; color: #fff; line-height: 1.1 }
.cover .legend { display: flex; gap: 3mm; margin-top: 8mm; flex-wrap: wrap }
.cover .legend span { padding: 1.8mm 4mm; border-radius: 99px; background: #ffffff; color: #0b1230; font-size: 10.5pt; font-weight: 600; border-left: 5mm solid }
.idx { padding: 10mm 12mm }
.idx h2 { margin: 0 0 3mm; font-size: 20pt; letter-spacing: -.3px } .idx h2 small { font-size: 11pt; color: #56617f; font-weight: 400 }
.idx-wrap { columns: 3; column-gap: 8mm; font-size: 8.6pt }
.idx-role { break-inside: avoid; margin-bottom: 4mm }
.idx-role h3 { margin: 0 0 1.5mm; font-size: 11pt }
.idx-role ul { list-style: none; margin: 0; padding: 0 }
.idx-role li { border-bottom: .2mm solid #dde3f2; padding: .45mm 0 }
.idx-role b { color: #56617f; font-weight: 600; margin-right: 1.5mm } .idx-role mark { font-weight: 400; background: none; padding: 0 }
.tiny { font-style: normal; font-size: 6.8pt; font-weight: 700; border-radius: 99px; padding: 0 1.4mm; margin-left: 1mm; vertical-align: 1px }
.tiny.chg { background: #fde7c7; color: #8a4b00 } .tiny.new { background: #d6f5e3; color: #066140 }
.gloss { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm 7mm; margin: 2mm 0 0; font-size: 9.6pt; line-height: 1.45 }
.gloss div { background: #fff; border-radius: 2.5mm; padding: 3mm 3.5mm; box-shadow: 0 0 0 .3mm #dde3f2 }
.gloss dt { font-weight: 700; color: #1e4fd8; margin-bottom: .8mm; font-size: 10.5pt } .gloss dd { margin: 0; color: #2b3456 }
.lead { font-size: 12pt; color: #2b3456; max-width: 260mm; margin: 0; line-height: 1.5 } .lead.small { margin-top: 5mm; font-size: 10pt }
.small-lead { font-size: 10pt; margin-bottom: 1mm }
.key { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 10mm; margin-top: 4mm }
.kc { display: flex; gap: 4mm; align-items: center; background: #ffffff; border-radius: 3mm; padding: 3.5mm 4mm; box-shadow: 0 0 0 .3mm #dde3f2 }
.sw { width: 16mm; height: 9mm; border-radius: 1.2mm; flex: none; display: grid; place-items: center; font-weight: 700; font-size: 13pt }
.kc strong { display: block; font-size: 11.5pt } .kc span { color: #2b3456; font-size: 10pt; line-height: 1.4 }
.day header { margin-bottom: 4mm }
.flow { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4mm }
.flow li { display: flex; align-items: center; gap: 5mm; padding: 4mm 5mm; background: #ffffff; border-radius: 3mm; box-shadow: 0 0 0 .3mm #dde3f2; position: relative }
.flow li:not(:last-child)::after { content: "▼"; position: absolute; left: 11mm; bottom: -4.6mm; font-size: 8pt; color: #a7b0c4; background: #f4f6fc; line-height: 1 }
.flow a { color: #fff; background: #0b1230; border-radius: 2mm; padding: 1.5mm 3mm; font-size: 12pt }
.flow strong { display: block; font-size: 13pt } .flow span { color: #2b3456; font-size: 11pt }
.app-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; align-items: start }
.app { border-collapse: collapse; width: 100%; font-size: 7.8pt; line-height: 1.2 } .app th, .app td { border-bottom: .2mm solid #dde3f2; padding: .8mm 2mm; text-align: left } .app th { color: #56617f; font-size: 7.4pt; font-weight: 600 }
header { display: flex; align-items: center; gap: 4mm; flex: none }
.code { color: #fff; font-weight: 700; font-size: 13pt; padding: 1.5mm 3.2mm; border-radius: 2mm; flex: none }
.titles h2 { margin: 0; font-size: 20pt; line-height: 1.1; letter-spacing: -.3px } .titles small { font-size: 11pt; color: #56617f; font-weight: 400 }
.titles mark { background: none; color: #1e4fd8; padding: 0; font-weight: 700 }
.meta { margin-left: auto; display: flex; gap: 2mm; align-items: center; flex-wrap: wrap; justify-content: flex-end }
.role { border: .35mm solid; border-radius: 99px; padding: .6mm 3mm; font-size: 9pt; font-weight: 600; background: #ffffff }
.badge { border-radius: 99px; padding: .7mm 2.6mm; font-size: 8.4pt; font-weight: 700; letter-spacing: .2px; display: inline-block }
.badge.chg { background: #fde7c7; color: #8a4b00 } .badge.new { background: #d6f5e3; color: #066140 } .badge.proto { background: #ffe9a8; color: #6b4600 }
code { font-family: Consolas, monospace; font-size: 8pt; color: #424c6b }
.shots { display: flex; gap: 5mm; align-items: flex-start; flex: 1; min-height: 0 }
.shots figure { height: 100%; display: flex; flex-direction: column; min-height: 0 }
figure { margin: 0 } figcaption { font-size: 7.5pt; color: #56617f; text-align: center; margin-top: 1mm; font-weight: 600 }
.desk img { width: auto; height: auto; max-width: 199mm; max-height: calc(100% - 5mm); display: block; border-radius: 2mm; box-shadow: 0 0 0 .3mm #bcc6e0, 0 1mm 3mm rgba(11,18,48,.1) }
.desk.wide img { max-width: 262mm }
.desk.narrow img { max-width: 110mm }
.mob img { height: calc(100% - 5mm); max-height: 124mm; width: auto; display: block; border-radius: 4mm; border: .6mm solid #0b1230; box-shadow: 0 1mm 3mm rgba(11,18,48,.18) }
.info { display: grid; grid-template-columns: 1.25fr 1fr 1.05fr; gap: 7mm; font-size: 9.6pt; line-height: 1.42; flex: none }
.info.two { grid-template-columns: 1fr 1.8fr }
.info h4 { margin: 0 0 1.2mm; font-size: 8pt; font-weight: 700; color: #56617f; text-transform: uppercase; letter-spacing: .3px }
.info p { margin: 0 0 1mm } .info .from { color: #0b1230 }
.note { color: #5c3300; background: #fbefdc; border-radius: 1.5mm; padding: 1mm 2.2mm; font-size: 9pt; margin-top: 1.2mm !important }
.acts { margin: 0; padding: 0; list-style: none } .acts li { margin-bottom: 1mm; display: flex; gap: 2mm; align-items: flex-start }
.dot { width: 5mm; flex: none; display: inline-flex; justify-content: center; padding-top: 1.6mm } .dot::before { content: ""; width: 1.6mm; height: 1.6mm; border-radius: 50%; background: #a7b0c4 }
.num { background: #e11d74; color: #fff; width: 5mm; height: 5mm; flex: none; border-radius: 50%; text-align: center; font: 700 8pt/5mm Arial }
.chgbox { background: #fff7ea; border-radius: 2mm; padding: 2mm 3mm; box-shadow: 0 0 0 .3mm #f3d6a6 }
.chgbox h4 { color: #8a4b00 } .chgbox ul { margin: 0; padding: 0; list-style: none } .chgbox li { margin-bottom: .8mm; font-size: 9pt }
.cid { background: #0b1230; color: #fff; border-radius: 1mm; padding: 0 1.2mm; font-size: 7.6pt; margin-right: 1mm } .cid.proto { background: #9a5200 }
.chgbox mark, .cc strong mark { background: none; padding: 0; color: inherit; font-weight: 700 }
.scr { display: inline-block; background: #0b1230; color: #fff; border-radius: 1mm; padding: .1mm 1.2mm; font-size: 7.4pt; font-weight: 700; line-height: 1.5 } .scr.many { background: #56617f }
.chip { display: inline-block; border: .3mm solid #1e4fd8; color: #15348f; border-radius: 99px; padding: 0 1.8mm; font-size: 7.2pt; font-weight: 600; margin: 0 .5mm }
.fxline { margin-top: 1.2mm !important; font-size: 8pt; color: #424c6b }
/* What changed */
.chg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; flex: 1; min-height: 0; align-content: start }
.cc { display: flex; gap: 2.5mm; background: #fff; border-radius: 2.5mm; padding: 2.2mm 3mm; box-shadow: 0 0 0 .3mm #dde3f2; font-size: 8.4pt; line-height: 1.38 }
.cc.proto { background: #fffaeb; box-shadow: 0 0 0 .3mm #f0d48a }
.cc .cn { background: #0b1230; color: #fff; border-radius: 1.2mm; padding: .4mm 1.4mm; font-size: 8pt; height: fit-content; flex: none }
.cc.proto .cn { background: #9a5200 }
.cc strong { display: block; font-size: 10pt; margin-bottom: 1mm; line-height: 1.25 }
.cc p { margin: 0 0 .8mm; color: #2b3456 } .cc .on { margin-top: 1.2mm; color: #56617f; font-size: 7.6pt }
.tb, .ta, .tn, .tp { display: inline-block; border-radius: 1mm; padding: 0 1.3mm; font-size: 7.2pt; font-weight: 700; margin-right: 1.2mm; vertical-align: 1px }
.tb { background: #fde8e7; color: #a4221a } .ta { background: #d6f5e3; color: #066140 } .tn { background: #dbe6ff; color: #15348f } .tp { background: #ffe9a8; color: #6b4600 }
.chgp .ba { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; font-size: 11pt; line-height: 1.45; flex: none }
.chgp .ba p { margin: 0; background: #fff; border-radius: 2mm; padding: 2.4mm 3.2mm; box-shadow: 0 0 0 .3mm #dde3f2 }
.chgp .ba .tb, .chgp .ba .ta { font-size: 8pt; margin-right: 2mm }
.chgp .meta.on { font-size: 8.5pt; color: #56617f; max-width: 120mm }
.cshots { flex: 1; min-height: 0; display: grid; gap: 4mm }
.cf { display: flex; flex-direction: column; min-height: 0; min-width: 0; position: relative }
.cf .tag { position: absolute; top: 2mm; left: 2mm; z-index: 1; font-size: 8pt; padding: .5mm 2.2mm; box-shadow: 0 .4mm 1.5mm rgba(11,18,48,.18) }
.cf .im { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; border-radius: 2.4mm; padding: 6mm 3mm 3mm; background: #e6ebf6 }
.cf.tb .im { background: #fbeeee; box-shadow: inset 0 0 0 .4mm #f2c4c0 } .cf.ta .im { background: #eaf8f0; box-shadow: inset 0 0 0 .4mm #a9e3c3 } .cf.tn .im { background: #eaf0ff; box-shadow: inset 0 0 0 .4mm #b8c9f5 } .cf.tp .im { background: #fff7df; box-shadow: inset 0 0 0 .4mm #f0d48a }
.cf img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; border-radius: 1.4mm; box-shadow: 0 .5mm 2mm rgba(11,18,48,.15) }
.cf figcaption { font-size: 8.6pt; color: #2b3456; text-align: left; font-weight: 400; margin-top: 1.2mm }
.why { margin: 0; font-size: 10pt; color: #2b3456; flex: none } .why b { color: #0b1230 }
table.small { border-collapse: separate; border-spacing: 0 2.5mm; width: 100%; font-size: 10.5pt; line-height: 1.4; flex: none }
table.small td { background: #fff; padding: 2.5mm 3mm; vertical-align: middle } table.small td:first-child { border-radius: 2mm 0 0 2mm } table.small td:last-child { border-radius: 0 2mm 2mm 0; width: 34mm; text-align: right }
table.small td.arrow { width: 8mm; text-align: center; color: #a7b0c4; font-size: 14pt; padding: 0 }
/* GSAP */
.fxt { border-collapse: collapse; width: 100%; font-size: 9pt; line-height: 1.32; background: #ffffff; border-radius: 2mm; overflow: hidden; box-shadow: 0 0 0 .3mm #dde3f2 }
.fxt th { text-align: left; font-size: 7.6pt; color: #56617f; font-weight: 600; padding: 1.5mm 2.4mm; border-bottom: .3mm solid #dde3f2; background: #f4f6fc }
.fxt td { padding: 1.2mm 2.4mm; border-bottom: .2mm solid #dde3f2; vertical-align: top; color: #2b3456 }
.fxt td:first-child { width: 62mm; color: #0b1230 } .fxt td:nth-child(2) { width: 22mm }
.fxt code { font-size: 7pt; color: #15348f }
.howgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; margin-top: 4mm; font-size: 9pt; line-height: 1.42; color: #2b3456 }
.howgrid h4 { margin: 0 0 1mm; font-size: 9.5pt; color: #0b1230 } .howgrid p { margin: 0 } .howgrid code { font-size: 7.6pt; color: #15348f }
.frows { display: flex; flex-direction: column; gap: 4mm; flex: 1; min-height: 0 }
.fr { flex: 1; min-height: 0; display: flex; flex-direction: column; margin: 0 }
.fr figcaption { text-align: left; font-size: 8.4pt; color: #2b3456; line-height: 1.3; margin: 0 0 1.6mm; font-weight: 400 }
.fr .frt { color: #0b1230; font-size: 9.5pt; margin-right: 1mm }
.fr .frc { margin-left: 1mm }
.steps { flex: 1; min-height: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 3mm }
.st { display: flex; flex-direction: column; min-height: 0; min-width: 0 }
.sti { flex: 1; min-height: 0; border-radius: 1.6mm; overflow: hidden; background: #e3e8f4; box-shadow: 0 0 0 .3mm #bcc6e0; display: flex; align-items: center; justify-content: center }
.sti img { width: 100%; height: 100%; object-fit: contain; display: block }
.stl { font-size: 8pt; color: #2b3456; margin-top: 1.2mm; display: flex; align-items: center; gap: 1.2mm }
.stl i { font-style: normal; font-weight: 700; flex: none; display: inline-grid; place-items: center; width: 3.8mm; height: 3.8mm; border-radius: 50%; background: #1e4fd8; color: #fff; font-size: 6.6pt }
</style></head><body>
<section class="page cover">
  <div class="brand"><i></i>Arena3</div>
  <h1>Từ điển màn hình</h1>
  <p>${rich("Mỗi màn hình một trang: ==ảnh thật== trên máy tính và điện thoại, ==một câu== nói màn đó để làm gì, và ==các nút cần bấm==.")}</p>
  <p>${rich(`Có mục riêng ==Những gì đã thay đổi== so với bản trước (main, 13/10/2026), với ảnh ==Trước== và ==Bây giờ== đặt cạnh nhau.`)}${esc(shootNote)}</p>
  <div class="read"><span><b class="num">1</b> nút được nhắc ở cột «Bấm gì»</span><span><mark>từ khoá</mark> điều cần nhớ</span><span><span class="badge chg">ĐÃ ĐỔI</span> màn có thay đổi</span><span><span class="badge new">MỚI</span> màn mới</span></div>
  <div class="stats"><div><b>${S.length}</b>màn hình</div><div><b>${Object.keys(ROLES).length}</b>nhóm người dùng</div><div><b>${CHANGES.length + SMALL.length}</b>thay đổi</div><div><b>${changedCount}</b>màn có thay đổi</div></div>
  <div class="legend">${Object.values(ROLES).map((r) => `<span style="border-left-color:${r.color}">${r.vn}</span>`).join("")}</div>
</section>
<section class="page idx"><h2>Mục lục</h2><div class="idx-wrap">${index}</div></section>
${changesPart}
${glossary}
${gridKey}
${days}
${pages}
${moreMenus}
${gsapPages}
${appendix}
</body></html>`;

writeFileSync(`${OUT}/index.html`, html);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(`${OUT}/index.html`)).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.pdf({ path: "docs/Arena3-Screen-Dictionary.pdf", width: "297mm", height: "210mm", printBackground: true });
await browser.close();
console.log("ok -> docs/Arena3-Screen-Dictionary.pdf");
