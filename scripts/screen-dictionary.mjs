// Screen dictionary: a real screenshot of every screen, one page each, with a plain-language description.
//   node scripts/screen-dictionary.mjs            -> shoots, builds docs/screen-dictionary/index.html and docs/Arena3-Screen-Dictionary.pdf
//   node scripts/screen-dictionary.mjs --no-shoot -> rebuild the document from the existing images
// Needs the app running on http://127.0.0.1:8080 (seeded demo data). It only READS: it never clicks a button
// that writes (no booking, payment, shift, promo...), so it is safe on any database. The only thing it
// creates is a sign-in session per role; set SESSIONS=path/to/sessions.json to reuse saved ones instead.
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
// `mark` = visible label of the control; when it is found on screen a numbered circle is drawn on the shot.
// `extra` adds a second page: the bottom of the page, or (with `tab`) the n-th tab opened, or (with a CSS
// selector as `tab`) that section scrolled into view. `view` is a button label clicked before the shots, for a
// filter that changes what is shown and nothing stored (a report period). All of it is read-only.
const A = (t, mark) => ({ t, mark });
const S = [
  // ── Public
  ["public", "/", "Trang chủ", "Mở website của trung tâm",
    "Trang giới thiệu cho người chưa có tài khoản, kể như một câu chuyện khi cuộn. Phần đầu nói ngay điều quan trọng nhất: trung tâm đang mở cửa không, hôm nay còn bao nhiêu giờ sân trống, giá từ bao nhiêu. Cuộn xuống lần lượt là dải số liệu, sân và bảng giá, lịch sân trống trực tiếp, ba bước đặt sân, huấn luyện viên, cơ sở vật chất, giá giờ thường và cao điểm, gói hội viên, lớp đang mở và cảm nhận của hội viên.",
    "Bất kỳ ai vào website, chưa cần tài khoản.",
    [A("Bấm «Đặt sân» để xuống thẳng lịch sân trống", "Đặt sân"), A("Bấm «Xem sân & bảng giá» để xem giá theo môn", "Xem sân & bảng giá"), A("Chạm một giờ trống trên lưới: trang báo giá và mời đăng nhập để giữ sân"), A("Đăng nhập hoặc tạo tài khoản", "Đăng nhập"), A("Đổi ngôn ngữ EN | VI")],
    "Ảnh trang sau là lịch sân trống. Chuyển động trên trang này được giải thích ở phần «Hiệu ứng GSAP» (G1-G6); nút || ở thanh trên tắt hết.",
    "Cuộn xuống: lịch sân trống trực tiếp", "#schedule"],
  ["public", "/login", "Đăng nhập", "Bấm «Đăng nhập» ở trang chủ",
    "Cửa vào chung của mọi người. Nhập số điện thoại (hoặc email) và mật khẩu; hệ thống tự đưa bạn đến đúng khu theo vai trò: quản lý, lễ tân, huấn luyện viên hay hội viên. Trên máy tính, nửa trái là video quầy lễ tân của trung tâm.",
    "Hội viên và nhân viên đã có tài khoản.",
    [A("Nhập số điện thoại hoặc email, và mật khẩu"), A("Bấm «Quên mật khẩu?» nếu quên", "Quên mật khẩu?"), A("Bấm «Tạo tài khoản» nếu chưa có", "Tạo tài khoản")],
    "Hàng «Tài khoản demo» chỉ có ở bản xem thử để người xem đăng nhập nhanh. Bản chạy thật tắt hàng này (biến VITE_DEMO_LOGINS)."],
  ["public", "/register", "Tạo tài khoản", "Bấm «Tạo tài khoản» ở trang đăng nhập",
    "Người mới tự tạo tài khoản hội viên: họ tên, số điện thoại, email, ngày sinh, mật khẩu (từ 8 ký tự, có chữ và số). Người dưới 18 tuổi phải điền thêm người giám hộ. Hệ thống gửi mã 6 số qua email để xác nhận.",
    "Người chưa là hội viên.",
    [A("Điền thông tin, tự chọn ngày sinh"), A("Tự tick ô đồng ý điều khoản và NĐ 13/2023"), A("Bấm «Gửi mã xác nhận»", "Gửi mã xác nhận"), A("Nhập mã 6 số để hoàn tất")],
    "Ngày sinh để trống và ô đồng ý không tick sẵn: nút gửi mã chỉ bật khi người dùng tự chọn ngày sinh và tự đồng ý. Bước nhập mã chỉ hiện sau khi gửi mã."],
  ["public", "/forgot", "Quên mật khẩu", "Bấm «Quên mật khẩu?» ở trang đăng nhập",
    "Lấy lại mật khẩu: nhập số điện thoại, hệ thống gửi mã 6 số tới email đã đăng ký (hết hạn sau 5 phút), rồi đặt mật khẩu mới. Tài khoản không có email thì nhờ lễ tân đặt mật khẩu tạm.",
    "Ai quên mật khẩu.",
    [A("Nhập số điện thoại, bấm «Gửi mã»", "Gửi mã"), A("Nhập mã 6 số và mật khẩu mới")],
    "Ảnh là bước đầu. Bước nhập mã và mật khẩu mới chỉ hiện sau khi gửi mã."],

  // ── Member
  ["member", "/app", "Trang chủ hội viên", nav("Lịch"),
    "Màn hình đầu tiên sau khi đăng nhập. Trên cùng là lời chào và mã hội viên, rồi các nhắc việc (gói sắp hết hạn, chỗ trống trong danh sách chờ). Khối «Hôm nay» đứng đầu (sân và lớp trong ngày, có nút trả online và hủy); bên cạnh là thẻ hội viên của gói đang dùng, có vệt sáng lướt qua khi rê chuột. Bên dưới là năm ô thao tác nhanh và thông báo mới nhất.",
    "Hội viên.",
    [A("Bấm «Gia hạn» khi gói sắp hết", "Gia hạn"), A("Xem lịch hôm nay, bấm «Hủy» nếu cần", "Hủy"), A("Đọc thông báo, bấm «Mở hộp thư» để xem hết", "Mở hộp thư")],
    "Trên điện thoại, ô thao tác nhanh được ẩn vì thanh dưới đã có đủ các mục chính."],
  ["member", "/app/book", "Đặt sân", nav("Đặt sân"),
    "Đầu trang là ảnh của môn đang chọn. Chọn ngày (mỗi ngày ghi số giờ còn trống) và môn, rồi chạm một giờ trống (ô viền xanh có dấu +) để giữ sân 5 phút. Biểu tượng môn trên ảnh đầu trang biến hình khi đổi môn. Thẻ giữ chỗ dính trên màn hình khi cuộn: vòng tròn cạn dần theo 5 phút (phút cuối chuyển đỏ và rung nhẹ một lần), mã đặt sân hiện ra từng ký tự, giá, và các cách trả: trừ giờ trong gói (nút có viền sáng chạy quanh), thanh toán online hoặc chuyển khoản. Trả xong, dấu tick tự vẽ và bung vài chấm sáng. Giờ đã qua được thu gọn. Trên điện thoại có dải «Giờ còn trống» để chọn theo giờ, hệ thống tự gán sân. Cột phải (máy tính) hoặc cuối trang (điện thoại) là các sân sắp tới của bạn, có «Đổi giờ» và «Hủy».",
    "Hội viên muốn chơi.",
    [A("Chọn ngày, chọn môn"), A("Chạm một giờ trống để giữ sân"), A("Bấm «Có mã khuyến mãi?» trước khi chọn giờ nếu có mã", "Có mã khuyến mãi?"), A("Chọn cách trả tiền trên thẻ giữ chỗ"), A("Bấm «Đổi giờ» ở sân đã đặt", "Đổi giờ")],
    "Mỗi ngày giữ được tối đa 2 khung giờ. Trang báo trước số lượt bạn đã có trong ngày đang xem."],
  ["member", "/app/classes", "Lớp học", nav("Lớp học"),
    "Các lớp do huấn luyện viên dạy, lọc theo môn. Mỗi lớp là một thẻ có ảnh môn, cho biết trình độ, huấn luyện viên, sân, lịch trong tuần và số chỗ còn lại. Lớp đầy thì vào danh sách chờ. Cuối trang là sổ «Điểm danh của tôi».",
    "Hội viên muốn học có người dạy.",
    [A("Lọc theo môn"), A("Bấm «Đăng ký»", "Đăng ký"), A("Bấm «Rời lớp này» để thôi học", "Rời lớp này"), A("Cuộn xuống xem sổ điểm danh của mình")],
    null, "Cuộn xuống: sổ điểm danh của tôi"],
  ["member", "/app/train", "Tiến độ tập luyện", nav("Tiến độ", "sheet"),
    "Mục tiêu cá nhân, trình độ hiện tại, các buổi sắp tới kèm giáo án, bài tập về nhà và nhận xét của huấn luyện viên. AI chỉ gợi ý; huấn luyện viên duyệt thì hội viên mới thấy.",
    "Hội viên đang học lớp.",
    [A("Chọn mục tiêu của mình"), A("Đánh dấu bài tập đã làm (khi có bài)"), A("Đọc nhận xét của huấn luyện viên")],
    "Mục nào chưa có nội dung thì hiện một dòng giải thích thay vì để trống."],
  ["member", "/app/plans", "Gói tập", nav("Gói tập", "sheet"),
    "Các gói đang bán, mỗi gói một thẻ có ảnh môn: môn, giá, thời hạn và quyền lợi (chỉ ghi những gì gói thật sự có). Bấm «Mua hoặc gia hạn» để đặt gói, trước khi trả tiền đã thấy ngày hết hạn mới; tiền trả tại quầy lễ tân.",
    "Hội viên muốn mua hoặc gia hạn gói.",
    [A("Nhập mã khuyến mãi nếu có"), A("So sánh các gói"), A("Bấm «Mua hoặc gia hạn»", "Mua hoặc gia hạn")],
    "Trang này không thu tiền online. Lễ tân thu ở màn «Thanh toán» (S19) hoặc trong hồ sơ hội viên (S26)."],
  ["member", "/app/points", "Điểm thưởng", nav("Điểm", "sheet"),
    "Số dư điểm, hạng hội viên và giá trị quy đổi. Mỗi 10.000đ chi tiêu được 1 điểm, 1 điểm trị giá 100đ. Đổi điểm lấy mã giảm giá (tối thiểu 50 điểm) và xem lịch sử đổi.",
    "Hội viên.",
    [A("Xem số dư và hạng"), A("Nhập số điểm, bấm «Nhận mã»", "Nhận mã"), A("Xem lịch sử đổi điểm")],
    null],
  ["member", "/app/pass", "Mã QR vào cổng", nav("Mã QR"),
    "Mã QR tự đổi mỗi phút để lễ tân quét khi vào trung tâm (chụp màn hình lại cũng vô dụng). Nếu trung tâm bật chế độ tự vào cổng, hội viên quét mã trên màn hình lễ tân hoặc dán vào ô «Mã từ màn hình lễ tân» rồi bấm «Vào cổng».",
    "Hội viên khi đến trung tâm.",
    [A("Đưa mã QR cho lễ tân quét"), A("Bấm «Mã mới» nếu mã hết hạn", "Mã mới"), A("Tự vào cổng bằng mã (chỉ khi quản lý bật)")],
    null],
  ["member", "/app/assistant", "Trợ lý", "Nút trợ lý (biểu tượng chat) ở thanh trên",
    "Chat hỏi nhanh: giờ mở cửa, gói nào đang bán, ai dạy cầu lông, hủy sân thế nào. Trả lời dựa trên dữ liệu thật của trung tâm. Gõ «ticket:» ở đầu câu để gửi ghi chú cho lễ tân.",
    "Hội viên có thắc mắc.",
    [A("Bấm câu hỏi gợi ý hoặc tự gõ"), A("Gõ «ticket: …» để nhắn lễ tân")],
    "Trợ lý không tư vấn y tế. Việc đặt sân và đăng ký lớp vẫn làm ở màn tương ứng."],
  ["member", "/app/notifications", "Thông báo", "Biểu tượng chuông ở thanh trên",
    "Hộp thư của hội viên: mỗi thông báo là một thẻ, có tiêu đề, một dòng tóm tắt nội dung và thời gian. Thẻ chưa đọc có chấm xanh và chữ đậm. Mở một thẻ để xem đầy đủ và đi tới màn liên quan.",
    "Hội viên.",
    [A("Mở một thông báo"), A("Bấm «Đánh dấu tất cả đã đọc»", "Đánh dấu tất cả đã đọc")],
    null],
  ["member", "/account", "Tài khoản", "Bấm avatar góc trên phải → «Cài đặt tài khoản»",
    "Bốn tab: Hồ sơ (thông tin cá nhân, ghi chú sức khoẻ), Bảo mật (đổi mật khẩu), Biên lai (mở PDF), Hỗ trợ (gửi tin cho lễ tân và đọc phản hồi). Số điện thoại và email không tự đổi được ở đây.",
    "Mọi người đã đăng nhập (hội viên, lễ tân, huấn luyện viên, quản lý).",
    [A("Sửa hồ sơ", "Hồ sơ"), A("Đổi mật khẩu", "Bảo mật"), A("Xem biên lai", "Biên lai"), A("Nhắn lễ tân", "Hỗ trợ")],
    "Muốn đổi số điện thoại hay email thì nhờ lễ tân."],
  ["member", "/pay/return", "Kết quả thanh toán online", "Tự chuyển về sau khi trả tiền online",
    "Trang hội viên thấy khi quay lại từ cổng thanh toán online. Nó tự kiểm tra và báo một trong các kết quả: đang chờ ngân hàng, đã thanh toán (dấu tick tự vẽ, sân hoặc gói được xác nhận, có biên lai), đã hủy, hoặc chưa rõ.",
    "Hội viên vừa trả tiền online.",
    [A("Đọc kết quả"), A("Quay lại xem sân hoặc gói đã đặt")],
    "Ảnh là trang mở thẳng, không qua cổng thanh toán, nên hiện trạng thái «chưa rõ»."],

  // ── Receptionist
  ["receptionist", "/desk", "Quầy lễ tân", nav("Quầy"),
    "Màn làm việc chính của lễ tân. Thanh trên cùng: mở hoặc đóng ca thu ngân, số khoản chờ thu, lối sang sơ đồ sân. Cột trái: tìm hội viên và thêm hội viên mới (3 bước: hồ sơ, gói tập, thanh toán). Cột phải: khối «Ngay lúc này» (số sân đang chơi, số khách vào trong 1 giờ tới, số sân trống giờ này, đếm lên khi mở trang), lối tắt và yêu cầu hỗ trợ từ ứng dụng. Nền trang là lưới chấm mờ, sáng lên quanh con trỏ chuột.",
    "Lễ tân.",
    [A("Bấm «Mở ca» trước khi thu tiền", "Mở ca"), A("Tìm hội viên theo tên, số điện thoại hoặc mã"), A("Thêm hội viên mới: bấm «Tạo hồ sơ»", "Tạo hồ sơ"), A("Xem «Ngay lúc này», bấm «Sơ đồ sân» để mở lưới", "Sơ đồ sân"), A("Trả lời yêu cầu hỗ trợ", "Trả lời")],
    "Trên điện thoại, cột phải xếp xuống dưới cột trái."],
  ["receptionist", "/desk/gate", "Cổng", nav("Cổng"),
    "Quét mã QR của hội viên để cho vào. Máy quét cầm tay tự gõ vào ô đang chọn; không có mã thì chuyển sang «Không có mã» và nhập số điện thoại. Kết quả hợp lệ hay không và lý do hiện ngay. Bên dưới là danh sách người đã qua cổng hôm nay.",
    "Lễ tân đứng cổng.",
    [A("Quét QR bằng máy quét", "Quét mã"), A("Nhập số điện thoại khi không có mã", "Không có mã"), A("Bấm «Hiện» để hiện mã tự vào cổng", "Hiện")],
    "Ghi nhận vào cổng không trừ buổi và không đổi gói tập."],
  ["receptionist", "/desk/courts", "Sơ đồ sân", nav("Sân"),
    "Lưới cả ngày của mọi sân, bắt đầu từ giờ hiện tại (giờ đã qua được thu gọn, bấm để hiện lại). Ô trống có viền xanh và dấu +, bấm để bán cho khách vãng lai ngay tại quầy. Bấm ô đã đặt để xem ai đang giữ sân và đến khi nào.",
    "Lễ tân.",
    [A("Chọn ngày và môn"), A("Bấm ô trống để bán cho khách vãng lai"), A("Bấm ô đã đặt để xem chi tiết")],
    "Màu các ô xem ở trang «Đọc lưới sân» đầu tài liệu."],
  ["receptionist", "/desk/payments", "Thanh toán", nav("Thanh toán"),
    "Hàng việc tiền tại quầy: gói đặt trong ứng dụng đang chờ thu, chuyển khoản cần đối soát, hoàn tiền chờ quản lý duyệt, và toàn bộ biên lai (lọc theo cách trả và khoảng ngày). Phải mở ca thu ngân mới thu được tiền.",
    "Lễ tân (thu tiền) và quản lý (duyệt hoàn tiền).",
    [A("Chọn cách trả, bấm thu tiền (cần mở ca trước)", "Mở ca trước"), A("Đối soát chuyển khoản: xác nhận đã nhận hoặc báo không thấy"), A("Tìm và mở biên lai")],
    "Ảnh chụp khi chưa mở ca nên nút thu tiền đang mờ. Chúng tôi không mở ca giả để chụp."],
  ["receptionist", "/desk/day-passes", "Vé ngày", nav("Vé ngày", "sheet"),
    "Bán vé vào cửa một ngày cho khách lẻ: tên, số điện thoại (không bắt buộc), ngày dùng, cách trả. Bán xong, khách vào cổng thì bấm xác nhận. Có số vé và doanh thu trong ngày.",
    "Lễ tân.",
    [A("Điền thông tin khách"), A("Bấm «Bán vé»", "Bán vé"), A("Xác nhận khi khách vào cổng")],
    "Cần mở ca thu ngân trước. Quản lý cũng mở được màn này từ menu «Thêm»."],
  ["receptionist", "/desk/series", "Đặt sân cố định", nav("Đặt cố định", "sheet"),
    "Đặt cùng sân, cùng giờ, mỗi tuần, trả trước cả đợt và được giảm giá. Chọn khách, sân, ngày đầu tiên, giờ bắt đầu và số tuần (4 đến 12), hệ thống kiểm tra từng tuần có trống không. Bên dưới là các đợt đang chạy.",
    "Lễ tân.",
    [A("Nhập số điện thoại khách (hoặc tên nếu là khách lẻ)"), A("Chọn sân, ngày, giờ, số tuần"), A("Bấm «Kiểm tra các tuần»", "Kiểm tra các tuần")],
    "Cần mở ca thu ngân trước khi thu tiền cả đợt."],
  ["receptionist", "/desk/at-risk", "Sắp rời bỏ", nav("Sắp rời bỏ", "more"),
    "Danh sách hội viên có thể sắp rời bỏ: vắng liên tiếp, lâu không đến, gói sắp hết hoặc chưa từng đến. Lọc theo nhóm, sắp xếp theo mức khẩn cấp. Gọi theo số trên dòng, gọi xong bấm «Ghi nhận liên hệ».",
    "Lễ tân, để chăm sóc khách.",
    [A("Chọn nhóm cần gọi", "Cần gọi"), A("Gọi theo số điện thoại trên dòng"), A("Bấm «Ghi nhận liên hệ»", "Ghi nhận liên hệ")],
    "Muốn bán gói cho người này, mở hồ sơ hội viên (S26)."],
  ["receptionist", "/desk/classes", "Lớp học (quầy)", nav("Lớp học", "more"),
    "Xem các lớp: trạng thái, trình độ, huấn luyện viên, sân, lịch và sĩ số. Bấm «Buổi học & học viên» để xem từng buổi và danh sách người học.",
    "Lễ tân.",
    [A("Xem các lớp và chỗ còn trống"), A("Bấm «Buổi học & học viên»", "Buổi học & học viên")],
    "Màn này chỉ để xem. Hội viên tự đăng ký lớp ở màn «Lớp học» (S07)."],
  ["receptionist", "/desk/gear", "Dụng cụ", nav("Dụng cụ", "more"),
    "Cho thuê vợt, bóng, ống cầu vào tài khoản hội viên hoặc cho khách theo số điện thoại. Kho tự trừ khi cho thuê và cộng lại khi trả. Bên dưới là các món đang cho thuê.",
    "Lễ tân.",
    [A("Chọn món, người thuê và số lượng"), A("Bấm «Cho thuê»", "Cho thuê"), A("Khi khách trả, bấm «Nhận lại»", "Nhận lại")],
    null],
  ["receptionist", "/desk/maintenance", "Bảo trì", nav("Bảo trì", "more"),
    "Báo cái gì đang hỏng (đèn, lưới, máy bơm...), gắn vào một sân và mức khẩn cấp; có thể khoá sân không cho đặt đến khi sửa xong. Có số phiếu đang mở, số phiếu khẩn cấp, chi phí sửa trong tháng, và danh sách phiếu để chuyển trạng thái.",
    "Lễ tân và quản lý.",
    [A("Mô tả chỗ hỏng, chọn sân và mức khẩn cấp"), A("Bấm «Gửi phiếu»", "Gửi phiếu"), A("Bấm «Bắt đầu sửa», «Đã sửa xong» hoặc «Hủy phiếu»", "Đã sửa xong")],
    null],
  ["receptionist", "/desk/member/$ID", "Hồ sơ hội viên", "Tìm hội viên ở màn «Quầy» (S16) rồi bấm vào tên",
    "Mọi thứ về một hội viên: thông tin liên hệ, gói đang dùng, các lượt đặt, khoản thanh toán và biên lai, cùng các việc lễ tân làm cho họ.",
    "Lễ tân (quản lý cũng mở được từ màn «Hội viên»).",
    [A("Bấm «Sửa hồ sơ»", "Sửa hồ sơ"), A("Bấm «Đặt lại mật khẩu»", "Đặt lại mật khẩu"), A("Bấm «Thu tiền»", "Thu tiền"), A("Bán thêm gói tập"), A("Xem biên lai, đề nghị hoàn tiền")],
    "Đặt sân hộ làm ở «Sơ đồ sân» (S18)."],
  ["receptionist", "/alerts", "Cảnh báo", "Biểu tượng chuông ở thanh trên",
    "Hộp thư cảnh báo dùng chung cho nhân viên (lễ tân, huấn luyện viên, quản lý), ví dụ học viên vắng ba buổi liên tiếp.",
    "Nhân viên.",
    [A("Mở một cảnh báo"), A("Xử lý rồi đánh dấu đã đọc")],
    "Ảnh có thể đang trống nếu chưa có cảnh báo."],

  // ── Coach
  ["coach", "/coach", "Lịch dạy", nav("Lịch"),
    "Màn đầu tiên của huấn luyện viên. Đầu trang là ảnh lớp tập, rồi thẻ «Buổi tiếp theo»: ngày, giờ, môn, trình độ, sân, sĩ số và nút «Điểm danh ngay». Bên dưới, mục «Sắp tới» liệt kê các buổi chia theo ngày, mỗi buổi một dòng gọn.",
    "Huấn luyện viên.",
    [A("Đọc thẻ «Buổi tiếp theo»"), A("Bấm «Điểm danh ngay»", "Điểm danh ngay"), A("Bấm một buổi trong danh sách để mở sổ của buổi đó")],
    null],
  ["coach", "/coach/attendance", "Điểm danh", nav("Điểm danh"),
    "Việc của một buổi chia thành 4 bước đánh số: 1 Điểm danh, 2 Kết quả, 3 Giáo án buổi tập, 4 Bài tập về nhà. Ở bước 1, mỗi học viên có 4 nút: Có mặt, Đến muộn, Vắng, Có phép; ghi chú sức khoẻ hiện ngay dưới tên. Sổ tự khoá sau một thời gian, sửa sau đó phải ghi lý do.",
    "Huấn luyện viên.",
    [A("Đổi buổi ở ô «Đổi buổi khác»"), A("Bấm trạng thái của từng học viên"), A("Bấm «Đánh dấu tất cả có mặt»", "Đánh dấu tất cả có mặt"), A("Bấm «Lưu điểm danh»", "Lưu điểm danh"), A("Bấm số 2, 3, 4 để sang kết quả, giáo án, bài tập")],
    "Ảnh trang sau là bước 3 (giáo án); bước 2 và 4 làm tương tự.",
    "Bước 3: giáo án buổi tập", 2],
  ["coach", "/coach/student/$ID", "Hồ sơ học viên", "Bấm tên học viên trong sổ điểm danh (S29)",
    "Phần trên: tên, mục tiêu, trình độ, số buổi có mặt, muộn, vắng, có phép, và khung ghi chú sức khoẻ. Phần dưới chia thẻ: Tiến độ (trình độ, nhận xét), Ghi chú của huấn luyện viên, Lịch sử (buổi gần đây và bài tập).",
    "Huấn luyện viên.",
    [A("Đọc ghi chú sức khoẻ"), A("Xem số buổi có mặt, muộn, vắng, có phép"), A("Chuyển giữa các thẻ Tiến độ, Ghi chú, Lịch sử")],
    "Số «có mặt» chỉ tăng khi huấn luyện viên đã lưu điểm danh.",
    "Thẻ Lịch sử: buổi gần đây và bài tập", 2],
  ["coach", "/coach/earnings", "Thu nhập", nav("Thu nhập"),
    "Tiền huấn luyện viên nhận theo tháng: một khoản cho mỗi buổi đã dạy, cộng thêm cho mỗi học viên có mặt. Có tổng đã kiếm, số buổi, số lượt học viên, mức trả đang áp dụng, danh sách buổi trong tháng và các tháng đã chốt.",
    "Huấn luyện viên.",
    [A("Chọn tháng bằng hai nút mũi tên"), A("Đối chiếu từng buổi đã dạy")],
    "Tháng chưa chốt thì số liệu còn có thể thay đổi."],

  // ── Manager
  ["manager", "/manager", "Báo cáo", nav("Báo cáo"),
    "Bức tranh kinh doanh theo khoảng thời gian. Đầu trang là ảnh nhà thi đấu với dòng «Chốt sổ cho kỳ này» và dải lối tắt sang Gói tập, Khuyến mãi, Bảng giá, Đặt cố định, Vé ngày, Hoa hồng, Hoá đơn điện tử, Bảo trì. Sau đó là doanh thu, hoàn tiền, giờ sân dùng từ gói (so với kỳ trước), biểu đồ theo cách trả và theo nguồn thu, công suất sân, giờ đông khách, hội viên mới và lớp học. Xuất Excel, PDF hoặc CSV.",
    "Quản lý, chủ trung tâm.",
    [A("Chọn Hôm nay / 7 ngày / Tháng này / Tuỳ chọn", "Hôm nay"), A("Lọc theo cách trả tiền"), A("Xuất Excel, PDF, CSV", "Xuất Excel")],
    "Ảnh chụp đang chọn «7 ngày» để thấy số liệu; mở trang thì mặc định là «Hôm nay». Ảnh trang sau là phần công suất sân và lớp học.",
    "Cuộn xuống: công suất sân và lớp học", null, "7 ngày"],
  ["manager", "/manager/classes", "Lớp học (quản lý)", nav("Lớp học", "sheet"),
    "Tạo lớp: môn, trình độ, sân, huấn luyện viên, các ngày trong tuần, giờ bắt đầu, ngày đầu tiên và sức chứa; hệ thống chặn trùng lịch sân hoặc trùng huấn luyện viên. Dời, hủy buổi, đổi huấn luyện viên hay hủy lớp làm trong «Buổi học & học viên».",
    "Quản lý.",
    [A("Điền biểu mẫu lớp mới"), A("Bấm «Tạo và đăng»", "Tạo và đăng"), A("Mở «Buổi học & học viên» để dời hoặc hủy buổi", "Buổi học & học viên")],
    null],
  ["manager", "/manager/members", "Hội viên", nav("Hội viên"),
    "Danh sách mọi hội viên, lọc nhanh theo gói (đang hiệu lực, hết hạn tuần này, hết hạn, chưa có gói), tìm theo tên, số điện thoại hoặc mã, lọc trạng thái và môn. Bấm một dòng để mở hồ sơ.",
    "Quản lý.",
    [A("Chọn nhóm lọc", "Tất cả"), A("Tìm theo tên, số điện thoại hoặc mã"), A("Mở hồ sơ hội viên (S26)")],
    null],
  ["manager", "/manager/attendance", "Điểm danh (báo cáo)", nav("Điểm danh"),
    "Hội viên có thực sự đến tập không: tỉ lệ điểm danh, số có mặt, vắng, có phép, theo từng lớp và huấn luyện viên, trong khoảng ngày chọn. Tab «Sắp rời bỏ» liệt kê ai cần gọi trước khi rời đi.",
    "Quản lý.",
    [A("Chọn khoảng ngày"), A("Xem theo lớp"), A("Xuất Excel hoặc PDF", "Xuất Excel")],
    null],
  ["manager", "/manager/staff", "Nhân viên", nav("Nhân viên", "sheet"),
    "Tài khoản lễ tân và huấn luyện viên chỉ được cấp ở đây (hội viên tự đăng ký). Đổi vai trò, đặt lại mật khẩu, đăng xuất mọi nơi, khoá hoặc mở khoá tài khoản.",
    "Quản lý.",
    [A("Bấm «Thêm nhân viên»", "Thêm nhân viên"), A("Bấm «Đặt lại mật khẩu»", "Đặt lại mật khẩu"), A("Bấm «Khóa» để khóa tài khoản", "Khóa")],
    "Nhân viên mới phải đổi mật khẩu ở lần đăng nhập đầu tiên."],
  ["manager", "/manager/plans", "Gói tập (quản lý)", nav("Gói tập", "more", "Kinh doanh"),
    "Mọi gói, cả đang bán và đã ngừng. Mỗi thẻ ghi môn, trạng thái bán, giá và quyền lợi. Gói không bao giờ bị xoá: ngừng bán thì hội viên đang dùng vẫn giữ nguyên.",
    "Quản lý.",
    [A("Bấm «Gói mới»", "Gói mới"), A("Bấm «Chi tiết» để sửa giá, quyền lợi", "Chi tiết"), A("«Ngừng bán» hoặc «Bán lại»", "Ngừng bán")],
    null],
  ["manager", "/manager/promos", "Khuyến mãi", nav("Khuyến mãi", "more", "Kinh doanh"),
    "Mã giảm giá theo % hoặc số tiền, có mức tối đa, phạm vi áp dụng, thời hạn và giới hạn lượt dùng. Mỗi mã hiện số lượt đã dùng và tổng tiền đã giảm.",
    "Quản lý.",
    [A("Bấm «Mã mới»", "Mã mới"), A("«Tạm dừng» hoặc «Tiếp tục» một mã", "Tạm dừng"), A("«Ai đã dùng» để xem lượt dùng", "Ai đã dùng")],
    null],
  ["manager", "/manager/prices", "Bảng giá", nav("Bảng giá", "more", "Kinh doanh"),
    "Giá thuê sân theo môn, loại ngày (thường, cuối tuần, lễ) và khung giờ (thường, cao điểm). Giá mới chỉ áp cho giao dịch mới; lượt đặt và gói đã bán giữ giá cũ.",
    "Quản lý.",
    [A("Mở từng môn"), A("Sửa giá trong ô"), A("Lưu thay đổi")],
    null],
  ["manager", "/manager/commission", "Hoa hồng huấn luyện viên", nav("Hoa hồng", "more", "Kinh doanh"),
    "Tiền trả cho huấn luyện viên theo tháng: tổng còn phải trả, số buổi đã dạy, số lượt học viên. Đặt mức trả mỗi buổi và mỗi học viên cho từng người.",
    "Quản lý.",
    [A("Chọn tháng"), A("Sửa mức trả của một huấn luyện viên"), A("Bấm «Lưu mức trả»", "Lưu mức trả")],
    "Tháng chưa chốt thì số liệu còn có thể thay đổi."],
  ["manager", "/manager/invoices", "Xuất hoá đơn điện tử", nav("Hoá đơn điện tử", "more", "Kinh doanh"),
    "Gửi hoá đơn của tháng cho kế toán dưới dạng bảng tính hoặc file XML để đưa vào hệ thống hoá đơn điện tử. Chọn khoảng ngày, xem số hoá đơn, tổng tiền, VAT và số hoá đơn chưa xuất.",
    "Quản lý, kế toán.",
    [A("Chọn khoảng ngày"), A("Bấm «Tải bảng tính (CSV)»", "Tải bảng tính (CSV)"), A("Bấm «Tải XML»", "Tải XML")],
    "Đây chưa phải hoá đơn phát hành: nhà cung cấp hoá đơn điện tử phát hành từ file này."],
  ["manager", "/manager/audit", "Nhật ký thao tác", nav("Nhật ký", "more", "Hệ thống"),
    "Ai đã làm gì, lúc nào, mới nhất trước: tên thao tác, người làm, vai trò, đối tượng. Mở một dòng để xem giá trị trước và sau. Không ai sửa hay xoá được nhật ký.",
    "Quản lý, để kiểm tra.",
    [A("Lọc theo thao tác, người làm, đối tượng, khoảng ngày"), A("Tìm trong danh sách"), A("Mở một dòng để xem trước và sau")],
    null],
  ["manager", "/manager/settings", "Cài đặt trung tâm", nav("Cài đặt", "more", "Hệ thống"),
    "Bật hoặc tắt tính năng (sổ điểm danh và giáo án, gợi ý giáo án, trợ lý hội viên), đưa từng sân vào «Đang mở / Bảo trì / Đã đóng», và thông tin pháp lý của trung tâm (tên, địa chỉ, mã số thuế).",
    "Quản lý.",
    [A("Bật hoặc tắt tính năng"), A("Đổi trạng thái từng sân"), A("Cuộn xuống: sửa thông tin trung tâm rồi lưu")],
    "Thay đổi áp dụng cho giao dịch mới trong vòng một phút.",
    "Cuộn xuống: sân và thông tin trung tâm"],
];

// ── GSAP: what each effect is, where, what it says, and what is left when motion is off.
// [name, tools, routes, meaning, still]
const FX_LANDING = [
  ["Cuộn có quán tính", "ScrollSmoother", ["/"], "Cả trang trượt mượt theo con lăn; ảnh nền trôi chậm hơn chữ nên có chiều sâu.", "Cuộn bình thường của trình duyệt."],
  ["Thanh tiến độ, header tự ẩn", "ScrollTrigger", ["/"], "Vạch xanh trên header cho biết đã đọc tới đâu; header lui lên khi cuộn xuống, hiện lại khi cuộn lên.", "Vạch vẫn chạy theo cuộn, header đứng yên."],
  ["Trạng thái tự giải mã", "ScrambleTextPlugin", ["/"], "«Đang mở cửa · đến 22:00» hiện ra như bảng điện tử, theo giờ thật của trung tâm.", "Chữ hiện ngay."],
  ["Tiêu đề trồi lên từng dòng", "SplitText (mask theo dòng)", ["/"], "Tiêu đề lớn và tiêu đề từng phần trồi lên khi cuộn tới, dẫn mắt vào nội dung chính. Tách theo từ, không theo ký tự, để dấu tiếng Việt không rời chữ.", "Chữ có sẵn."],
  ["Quả cầu được giao lên nút", "MotionPathPlugin + timeline", ["/"], "Một quả cầu lông bay theo đường cong rồi đáp xuống nút «Đặt sân», chỉ vào hành động chính của trang.", "Không có."],
  ["Số đếm lên", "gsap.to + ScrollTrigger", ["/"], "Số giờ sân trống, dải số liệu, giá sân và giá gói đếm từ 0 khi cuộn tới.", "Số hiện sẵn."],
  ["«Ba bước» được giữ lại", "ScrollTrigger (pin, scrub) + timeline", ["/"], "Phần này đứng yên trong lúc cuộn; đường nối vẽ dần và chọn, giữ, trả lần lượt sáng lên, đúng thứ tự đặt sân. Chỉ trên máy tính.", "Cả ba bước sáng sẵn, không đứng lại."],
  ["Câu tuyên bố rõ dần", "SplitText + ScrollTrigger (scrub)", ["/"], "Từng từ rõ dần theo tốc độ cuộn của người đọc: chỗ duy nhất trang muốn người ta đọc chậm.", "Chữ rõ sẵn."],
  ["Lọc huấn luyện viên", "Flip", ["/"], "Đổi môn thì thẻ còn lại trượt về chỗ mới, thẻ mới phóng ra đúng chỗ, nên thấy được ai đi đâu.", "Lưới đổi ngay."],
  ["Cơ sở vật chất trượt ngang", "ScrollTrigger (pin, containerAnimation)", ["/"], "Cuộn dọc mà ảnh chạy ngang, như đi dọc nhà thi đấu; chú thích từng ảnh hiện khi ảnh tới giữa. Chỉ trên máy tính.", "Lưới ảnh bình thường."],
  ["Thanh giờ cao điểm", "timeline + ScrollTrigger", ["/"], "Ngày 06:00-22:00 vẽ từ bảng giá thật: giờ thường đổ trước, giờ cao điểm đổ sau, một vệt sáng chạy qua.", "Thanh hiện sẵn."],
  ["Thanh chỗ ngồi của lớp", "gsap.fromTo + ScrollTrigger", ["/"], "Mỗi thanh chạy tới đúng tỉ lệ chỗ đã có người.", "Thanh hiện sẵn."],
  ["Dải lớp học", "gsap.ticker + ScrollTrigger.getVelocity", ["/"], "Dải chạy tự do, cuộn mạnh thì chạy nhanh, cuộn ngược thì chạy ngược; dừng khi rê chuột.", "Đứng yên, xuống dòng cho đủ."],
];
const FX_APP = [
  ["Vòng giữ sân", "DrawSVGPlugin", ["/app/book"], "Vòng tròn cạn dần theo 5 phút giữ sân, bám đồng hồ thật nên mở lại máy vẫn đúng giờ.", "Vòng vẫn cập nhật, chỉ không lướt."],
  ["Phút cuối rung một lần", "CustomWiggle", ["/app/book"], "Còn 60 giây thì vòng và giờ chuyển đỏ, cả cụm rung nhẹ một lần: lúc cần báo, không phải lúc cho biết.", "Chỉ đổi màu."],
  ["Mã đặt sân giải mã", "ScrambleTextPlugin", ["/app/book"], "Mã CRT-... hiện ra từng ký tự đúng lúc nó được cấp.", "Mã hiện ngay."],
  ["Icon môn biến hình", "MorphSVGPlugin", ["/app/book"], "Đổi môn thì icon trên ảnh đầu trang biến từ môn này sang môn kia, trước cả khi ảnh mới tải xong.", "Icon đổi ngay."],
  ["Tick và chấm sáng khi trả xong", "DrawSVGPlugin + Physics2DPlugin", ["/app/book", "/pay/return"], "Dấu tick tự vẽ, vài chấm xanh và vàng chanh bung ra rồi rơi theo trọng lực. Chỉ khi tiền thật sự được xác nhận.", "Chỉ có dấu tick."],
];
const FX_CHIPS = {
  "/": ["ScrollSmoother", "ScrollTrigger", "SplitText", "ScrambleText", "MotionPath", "Flip", "timeline"],
  "/app/book": ["DrawSVG", "CustomWiggle", "ScrambleText", "MorphSVG", "Physics2D"],
  "/pay/return": ["DrawSVG", "Physics2D"],
};
// Each effect shot step by step (files G01-1.jpg, G01-2.jpg...), the last step being the finished
// state. [id, title, tools, route, caption, step labels]
const FRAMES = [
  ["G01", "Mở đầu trang chủ", "ScrambleText · SplitText", "/", "Dòng trạng thái giải mã như bảng điện tử, rồi từng từ của tiêu đề trồi lên khỏi mặt nạ dòng.", ["Trạng thái đang giải mã", "Tiêu đề đang trồi lên", "Xong"]],
  ["G02", "Quả cầu bay tới nút «Đặt sân»", "MotionPath · timeline", "/", "Quả cầu bay theo đường cong, nghiêng theo hướng bay, rồi đáp xuống nút chính. Vòng xanh chanh chỉ để đánh dấu trong ảnh.", ["Bay vào từ mép phải", "Qua đỉnh đường cong", "Đáp xuống nút"]],
  ["G03", "Câu tuyên bố rõ dần theo cuộn", "SplitText · scrub", "/", "Độ rõ đi theo vị trí cuộn: chữ chưa tới lượt được làm mờ có chủ ý, cuộn tới đâu rõ tới đó.", ["Vừa cuộn tới", "Cuộn nửa đường", "Cuộn qua: rõ cả câu"]],
  ["G04", "«Ba bước» đứng lại khi cuộn", "ScrollTrigger pin · scrub", "/", "Phần này đứng yên trong lúc cuộn; đường nối vẽ dần và ba bước lần lượt sáng.", ["Vừa đứng lại", "Giữa đoạn: tới bước 2", "Hết đoạn: cả ba bước sáng"]],
  ["G05", "Lọc huấn luyện viên", "Flip", "/", "Bấm một môn: thẻ còn lại trượt từ chỗ cũ về chỗ mới thay vì nhảy, lưới co lại cùng lúc.", ["Trước: Tất cả", "Đang trượt", "Sau: Bóng rổ"]],
  ["G06", "Cơ sở vật chất trượt ngang", "ScrollTrigger pin · containerAnimation", "/", "Cuộn dọc mà dãy ảnh chạy ngang; chú thích từng ảnh hiện khi ảnh tới giữa.", ["Đầu đoạn", "Nửa đường", "Cuối đoạn"]],
  ["G07", "Thanh giờ cao điểm", "timeline", "/", "Ngày 06:00-22:00 vẽ từ bảng giá thật: giờ thường đổ trước, cao điểm 17:00-22:00 đổ sau.", ["Giờ thường đang đổ", "Cao điểm đang đổ", "Xong"]],
  ["G08", "Icon môn biến hình", "MorphSVG", "/app/book", "Đổi môn ở trang Đặt sân: icon trên ảnh đầu trang biến từ môn này sang môn kia.", ["Cầu lông", "Đang biến hình", "Bóng rổ"]],
  ["G09", "Giữ sân: mã và vòng 5 phút", "ScrambleText · DrawSVG", "/app/book", "Mã đặt sân hiện ra từng ký tự lúc được cấp; vòng tròn cạn dần theo thời gian giữ còn lại.", ["Mã đang giải", "Mã đã cấp", "Còn khoảng 2 phút"]],
  ["G10", "Phút cuối", "CustomWiggle", "/app/book", "Qua mốc 60 giây: vòng và giờ chuyển đỏ, cả cụm rung nhẹ một lần.", ["Còn hơn 1 phút", "Mốc 60 giây: đang rung", "Sau đó: đỏ, đứng yên"]],
  ["G11", "Thanh toán xong", "DrawSVG · Physics2D", "/app/book", "Trả bằng giờ trong gói: vòng và dấu tick tự vẽ, vài chấm sáng bung ra rồi rơi.", ["Vòng đang vẽ", "Chấm sáng đang bung", "Xong"]],
  ["G12", "Khi tắt chuyển động", "gsap.matchMedia", "/", "Cùng phần «Ba bước»: khi máy bật giảm chuyển động hoặc bấm ||, không đứng lại, ba bước sáng sẵn.", ["Có chuyển động (giữa đoạn)", "Giảm chuyển động"]],
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
  // All of it on the in-memory database.
  const members = ["0901230101", "0901230104", "0901230105", "0901230107", "0901230108", "0901230109", "0901230110", "0901230102"];
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
      const plan = pg.getByRole("button", { name: "Dùng giờ trong gói tập" });
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
    await page.getByRole("button", { name: "Dùng giờ trong gói tập" }).click();
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
          if (typeof row[9] === "string") {
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
const byRole = Object.keys(ROLES).map((k) => ({ k, rows: S.map((r, i) => ({ r, i })).filter((x) => x.r[0] === k) }));
const reachOf = (r) => (typeof r[3] === "string" ? { d: r[3], m: r[3] } : reach(r[3]));
const roleChip = (k) => `<span class="role" style="color:${ROLES[k].color};border-color:${ROLES[k].color}">${ROLES[k].vn}</span>`;
const head = (k, code, title, small = "") => `<header><span class="code" style="background:${ROLES[k]?.color ?? "#0b1230"}">${code}</span><div class="titles"><h2>${esc(title)}${small ? ` <small>${small}</small>` : ""}</h2></div><div class="meta">${ROLES[k] ? roleChip(k) : ""}</div></header>`;
const codeOf = (route) => idOf(S.findIndex((r) => r[1] === route));

// Numbers only for controls that are really visible on the shot.
const actionsHtml = (i, r) => {
  const fd = marksFound[`${idOf(i)}-d`] ?? [];
  return r[6].map((a, k) => (fd[k] ? `<li><b class="num">${fd[k]}</b><span>${esc(a.t)}</span></li>` : `<li class="plain"><span>${esc(a.t)}</span></li>`)).join("");
};

const index =
  byRole
    .map(({ k, rows }) => `<div class="idx-role"><h3 style="color:${ROLES[k].color}">${ROLES[k].vn}</h3><ul>${rows.map(({ r, i }) => `<li><a href="#${idOf(i)}"><b>${idOf(i)}</b> ${esc(r[2])}</a></li>`).join("")}</ul></div>`)
    .join("") +
  `<div class="idx-role"><h3>Trang hướng dẫn</h3><ul><li>Từ khó hiểu</li><li>Đọc lưới sân</li><li>Một ngày của từng vai</li><li>G1-G2 Hiệu ứng GSAP</li><li>G3-G6 Khung hình GSAP</li><li>Menu «Thêm»</li><li>Phụ lục kỹ thuật</li></ul></div>`;

const mkPage = (i, r) => {
  const k = r[0];
  const rc = reachOf(r);
  const reachHtml = rc.d === rc.m ? `<p class="from"><b>Vào bằng đâu:</b> ${esc(rc.d)}</p>` : `<p class="from"><b>Máy tính:</b> ${esc(rc.d)}<br><b>Điện thoại:</b> ${esc(rc.m)}</p>`;
  const first = `
<section class="page" id="${idOf(i)}">
  ${head(k, idOf(i), r[2])}
  <div class="shots">
    <figure class="desk"><img src="img/${idOf(i)}-d.jpg" alt=""><figcaption>Trên máy tính</figcaption></figure>
    <figure class="mob"><img src="img/${idOf(i)}-m.jpg" alt=""><figcaption>Trên điện thoại</figcaption></figure>
  </div>
  <div class="info">
    <div><h4>Dùng để làm gì</h4><p>${esc(r[4])}</p>${r[7] ? `<p class="note">${esc(r[7])}</p>` : ""}</div>
    <div><h4>Ai dùng, vào bằng đâu</h4><p>${esc(r[5])}</p>${reachHtml}</div>
    <div><h4>Làm được gì ở đây</h4><ul>${actionsHtml(i, r)}</ul></div>
  </div>
  ${FX_CHIPS[r[1]] ? `<p class="fxline"><b>Hiệu ứng GSAP trên màn này:</b> ${FX_CHIPS[r[1]].map((c) => `<span class="chip">${c}</span>`).join("")} <i>Xem phần «Hiệu ứng GSAP» (G1-G6).</i></p>` : ""}
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

const moreMenus = `
<section class="page" id="MORE">
  ${head("", "+", "Menu «Thêm»")}
  <div class="shots">
    <figure class="mob"><img src="img/MORE-member-m.jpg" alt=""><figcaption>Hội viên, điện thoại</figcaption></figure>
    <figure class="mob"><img src="img/MORE-receptionist-m.jpg" alt=""><figcaption>Lễ tân, điện thoại</figcaption></figure>
    <figure class="mob"><img src="img/MORE-manager-m.jpg" alt=""><figcaption>Quản lý, điện thoại</figcaption></figure>
    <figure class="desk narrow"><img src="img/MORE-manager-d.jpg" alt=""><figcaption>Quản lý, máy tính</figcaption></figure>
  </div>
  <div class="info two">
    <div><h4>Vì sao cần</h4><p>Thanh dưới trên điện thoại chỉ giữ 5 mục dùng nhiều nhất, thanh trên máy tính hiện vừa đủ chỗ. Các mục còn lại nằm trong nút «Thêm». Ở quản lý, menu «Thêm» chia ba nhóm: Kinh doanh, Vận hành, Hệ thống.</p></div>
    <div><h4>Mục nào nằm trong «Thêm»</h4><ul>
      <li class="plain"><span><b>Hội viên (điện thoại):</b> Tiến độ, Gói tập, Điểm</span></li>
      <li class="plain"><span><b>Lễ tân:</b> Sắp rời bỏ, Lớp học, Dụng cụ, Bảo trì; trên điện thoại thêm Vé ngày và Đặt cố định</span></li>
      <li class="plain"><span><b>Quản lý:</b> Kinh doanh (Gói tập, Khuyến mãi, Bảng giá, Hoa hồng, Hoá đơn điện tử), Vận hành (Đặt cố định, Vé ngày, Bảo trì), Hệ thống (Nhật ký, Cài đặt); trên điện thoại thêm Lớp học và Nhân viên</span></li>
    </ul></div>
  </div>
</section>`;

const glossary = `
<section class="page idx" id="GLOSS">
  <h2>Từ khó hiểu, giải thích một lần</h2>
  <dl class="gloss">
    <div><dt>Giữ sân 5 phút</dt><dd>Khi hội viên chạm một giờ trống, sân được giữ riêng 5 phút để họ thanh toán. Hết 5 phút mà chưa trả thì sân trả lại cho người khác.</dd></div>
    <div><dt>Giờ còn trống (điện thoại)</dt><dd>Dải giờ phía trên lưới sân: chạm một giờ là hệ thống tự chọn một sân còn trống trong giờ đó, không cần dò từng sân.</dd></div>
    <div><dt>Mã QR vào cổng</dt><dd>Mã trên điện thoại hội viên, tự đổi mỗi phút. Lễ tân quét để cho vào. Chụp màn hình cũng không dùng lại được.</dd></div>
    <div><dt>Mở ca, ca thu ngân</dt><dd>Mỗi lần lễ tân bắt đầu thu tiền thì mở ca (như mở két). Cuối ca đóng ca để đối chiếu tiền. Chưa mở ca thì không thu được tiền.</dd></div>
    <div><dt>Đối soát chuyển khoản</dt><dd>Kiểm tra khoản khách nói đã chuyển có thật sự vào tài khoản trung tâm chưa. Có thì xác nhận, không thấy thì báo lại.</dd></div>
    <div><dt>Hoàn tiền chờ quản lý</dt><dd>Lễ tân đề nghị trả lại tiền; vượt hạn mức thì quản lý phải đồng ý mới trả. Tránh trả nhầm.</dd></div>
    <div><dt>Vé ngày</dt><dd>Vé vào cửa một ngày cho khách lẻ không có gói, bán tại quầy.</dd></div>
    <div><dt>Đặt sân cố định</dt><dd>Cùng sân, cùng giờ, mỗi tuần, trả trước cả đợt 4 đến 12 tuần và được giảm giá.</dd></div>
    <div><dt>Danh sách chờ</dt><dd>Lớp đầy thì hội viên xếp hàng chờ; có người rời lớp thì người đầu hàng được mời vào.</dd></div>
    <div><dt>Sắp rời bỏ</dt><dd>Hội viên vắng liên tiếp, lâu không đến hoặc gói sắp hết. Nhân viên gọi nhắc để giữ chân họ.</dd></div>
    <div><dt>Điểm thưởng</dt><dd>Mỗi 10.000đ chi tiêu được 1 điểm, 1 điểm trị giá 100đ, đổi thành mã giảm giá.</dd></div>
    <div><dt>Hoa hồng huấn luyện viên</dt><dd>Một khoản cho mỗi buổi đã dạy cộng thêm cho mỗi học viên có mặt, chốt theo tháng.</dd></div>
    <div><dt>Mã xác nhận 6 số</dt><dd>Mã gửi qua email để chứng minh đúng người khi tạo tài khoản hoặc quên mật khẩu.</dd></div>
    <div><dt>Trợ lý AI</dt><dd>Chat trả lời hội viên dựa trên dữ liệu thật của trung tâm. AI chỉ gợi ý; con người duyệt việc quan trọng.</dd></div>
    <div><dt>Nhật ký thao tác</dt><dd>Sổ tự ghi ai làm gì lúc nào, kèm giá trị trước và sau. Không ai sửa hay xoá được.</dd></div>
  </dl>
</section>`;

// The court grid key, drawn with the same colours the app uses.
const STRIPES = "repeating-linear-gradient(45deg,rgba(11,18,48,.12) 0 3px,transparent 3px 7px)";
const SW = [
  ["free", "Trống", "Viền xanh có dấu +. Bấm vào được. Đây là ô nổi bật nhất trên lưới.", "background:#ffffff;box-shadow:inset 0 0 0 1px rgba(30,79,216,.45);color:#1e4fd8", "+"],
  ["hold", "Đang giữ chỗ", "Ai đó đang giữ 5 phút để thanh toán. Viền vàng đứt nét vì trạng thái này tự hết.", `background:${STRIPES},rgba(154,82,0,.15);border:1px dashed #9a5200`, ""],
  ["booked", "Đã đặt", "Đã có người đặt. Nền xanh nhạt, lùi về sau để ô trống nổi lên.", "background:rgba(30,79,216,.15)", ""],
  ["in_use", "Đang dùng", "Đã đặt và đang có người chơi đúng giờ này. Màu đậm duy nhất.", "background:#15348f", ""],
  ["class", "Lớp", "Giờ của một lớp có huấn luyện viên.", "background:#0b1230", ""],
  ["maintenance", "Bảo trì", "Sân đang sửa, không bán. Gạch chéo.", `background:${STRIPES},#e8edf9`, ""],
  ["closed", "Đã đóng", "Sân tạm đóng, không bán. Gạch chéo đậm hơn.", `background:${STRIPES},rgba(188,198,224,.45)`, ""],
  ["past", "Đã qua", "Giờ đã kết thúc. Mặc định được thu gọn; bấm «Hiện … giờ đã qua» để xem lại.", "background:rgba(232,237,249,.5)", ""],
];
const gridKey = `
<section class="page idx" id="GRID">
  <h2>Đọc lưới sân</h2>
  <p class="lead">Lưới sân xuất hiện ở trang chủ (S01), màn Đặt sân của hội viên (S06) và Sơ đồ sân của lễ tân (S18). Mỗi hàng là một giờ, mỗi cột là một sân. Cả ba nơi dùng chung bảng màu dưới đây.</p>
  <div class="key">${SW.map(([, name, what, style, glyph]) => `<div class="kc"><span class="sw" style="${style}">${glyph}</span><div><strong>${name}</strong><span>${what}</span></div></div>`).join("")}</div>
  <p class="lead small">Trên điện thoại, lưới chuyển thành từng thẻ sân vuốt ngang, phía trên có dải «Giờ còn trống». Hàng giờ hiện tại có chấm xanh ở cột giờ.</p>
</section>`;

const dayPage = (k, title, steps) => `
<section class="page idx day">
  ${head(k, "▶", `Một ngày của ${title}`)}
  <ol class="flow">${steps.map(([route, name, what]) => `<li><a href="#${codeOf(route)}"><b>${codeOf(route)}</b></a><div><strong>${esc(name)}</strong><span>${esc(what)}</span></div></li>`).join("")}</ol>
</section>`;
const days = [
  dayPage("member", "hội viên", [["/app", "Trang chủ hội viên", "Xem lịch hôm nay và gói đang dùng"], ["/app/book", "Đặt sân", "Chạm giờ trống, giữ sân 5 phút, thanh toán"], ["/app/pass", "Mã QR vào cổng", "Đến trung tâm, đưa mã cho lễ tân quét"], ["/app/classes", "Lớp học", "Đăng ký lớp có huấn luyện viên"], ["/app/train", "Tiến độ", "Làm bài tập, đọc nhận xét"]]),
  dayPage("receptionist", "lễ tân", [["/desk", "Quầy", "Mở ca, xem «Ngay lúc này», tìm hội viên"], ["/desk/gate", "Cổng", "Quét QR cho khách vào"], ["/desk/courts", "Sơ đồ sân", "Bán giờ trống cho khách vãng lai"], ["/desk/payments", "Thanh toán", "Thu tiền, đối soát chuyển khoản"], ["/desk/at-risk", "Sắp rời bỏ", "Gọi nhắc hội viên lâu không đến"]]),
  dayPage("coach", "huấn luyện viên", [["/coach", "Lịch dạy", "Xem buổi tiếp theo"], ["/coach/attendance", "Điểm danh", "Đánh dấu từng học viên, lưu sổ, lên giáo án"], ["/coach/student/$ID", "Hồ sơ học viên", "Xem ghi chú sức khoẻ, nhận xét tiến bộ"], ["/coach/earnings", "Thu nhập", "Đối chiếu buổi đã dạy trong tháng"]]),
  dayPage("manager", "quản lý", [["/manager", "Báo cáo", "Xem doanh thu, công suất sân, xuất file"], ["/manager/attendance", "Điểm danh", "Xem ai thực sự đến tập"], ["/manager/plans", "Gói tập", "Tạo hoặc sửa gói đang bán"], ["/manager/staff", "Nhân viên", "Cấp tài khoản lễ tân và huấn luyện viên"], ["/manager/audit", "Nhật ký thao tác", "Kiểm tra ai đã làm gì"]]),
].join("");

const fxRows = (rows) =>
  rows
    .map(
      ([name, tools, routes, meaning, still]) =>
        `<tr><td><b>${esc(name)}</b></td><td><code>${esc(tools)}</code></td><td>${routes.map((r) => `<b class="scr">${codeOf(r)}</b>`).join(" ")}</td><td>${esc(meaning)}</td><td>${esc(still)}</td></tr>`,
    )
    .join("");
const fxTable = (rows) =>
  `<table class="fxt"><tr><th>Hiệu ứng</th><th>Công cụ GSAP</th><th>Ở màn</th><th>Nói lên điều gì</th><th>Khi tắt chuyển động</th></tr>${fxRows(rows)}</table>`;
const gsapPages = `
<section class="page idx" id="G1">
  ${head("", "G1", "Hiệu ứng GSAP: trang chủ")}
  <p class="lead">GSAP là thư viện hoạt ảnh JavaScript. Arena3 dùng nó ở hai chỗ: trang chủ, kể như một câu chuyện khi cuộn, và vài khoảnh khắc trong ứng dụng (trang G2). Mọi hiệu ứng đều chỉ vào một thông tin thật (giờ trống, giá, 5 phút giữ sân, tiền đã nhận), không có hiệu ứng nào nằm trên ô lưới sân, và tất cả tắt khi máy bật giảm chuyển động hoặc khi bấm nút || ở thanh trên. Các chuyển động khác trong ứng dụng (thẻ hiện dần, ánh sáng theo chuột) dùng thư viện motion và không nằm trong bảng này.</p>
  ${fxTable(FX_LANDING)}
</section>
<section class="page idx" id="G2">
  ${head("", "G2", "Hiệu ứng GSAP: trong ứng dụng, và cách hoạt động")}
  <p class="lead">Trong ứng dụng, GSAP chỉ lo những khoảnh khắc được dàn dựng: thời gian giữ sân đang trôi, một mã vừa cấp, tiền vừa nhận. Chuyển cảnh thường ngày (danh sách, thẻ, menu) vẫn dùng motion.</p>
  ${fxTable(FX_APP)}
  <div class="howgrid">
    <div><h4>Một nhịp chung</h4><p>Mọi hiệu ứng dùng chung một đường cong tốc độ tên <code>arena</code> (CustomEase, cùng đường cong với phần còn lại của ứng dụng), nên các chuyển động ăn khớp với nhau.</p></div>
    <div><h4>Tắt là tắt hẳn</h4><p>Mỗi cảnh đi qua <code>useScene()</code>: gsap.matchMedia theo dõi chế độ giảm chuyển động của máy và nút ||. Khi tắt, cảnh không tạo gì cả; giao diện vốn đã ở trạng thái cuối, nên không chữ nào bị ẩn và ô đang gõ không mất chữ.</p></div>
    <div><h4>Máy tính và điện thoại</h4><p>Các đoạn đứng lại khi cuộn và trượt ngang chỉ chạy từ 768px trở lên. Trên điện thoại, nội dung hiện dần theo thứ tự bình thường và trang không bao giờ cuộn ngang.</p></div>
    <div><h4>Mã nguồn</h4><p><code>src/lib/gsap.ts</code> (lõi, useScene), <code>src/components/landing/*</code> (các cảnh trang chủ), <code>src/components/moments/*</code> (khoảnh khắc trong ứng dụng).</p></div>
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
        return `<figure class="fr"><figcaption><b class="frt">${id} · ${esc(title)}</b> <span class="chip">${esc(tools)}</span> <b class="scr">${codeOf(route)}</b> <span class="frc">${esc(cap)}</span></figcaption><div class="steps">${steps
          .map(([file, label, n]) => `<div class="st"><div class="sti"><img src="img/${file}.jpg" alt=""></div><span class="stl"><i>${n}</i>${esc(label)}</span></div>`)
          .join("")}</div></figure>`;
      })
      .join("");
    return `
<section class="page idx" id="G${gi + 3}">
  ${head("", `G${gi + 3}`, `Khung hình GSAP, từng bước (${gi + 1}/4)`)}
  <p class="lead small-lead">Mỗi hiệu ứng chụp theo thứ tự, ảnh cuối là lúc hiệu ứng đã xong. GSAP được làm chậm rồi dừng đúng khoảnh khắc đó, nên ảnh không nhòe vì chuyển động; chỗ còn mờ hay chưa hiện ở bước đầu chính là hiệu ứng.</p>
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
</section>`;

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Arena3: Từ điển màn hình</title>
<link rel="stylesheet" href="../../node_modules/@fontsource/be-vietnam-pro/400.css">
<link rel="stylesheet" href="../../node_modules/@fontsource/be-vietnam-pro/600.css">
<link rel="stylesheet" href="../../node_modules/@fontsource/be-vietnam-pro/700.css">
<style>
@page { size: A4 landscape; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif; color: #0b1230; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.page { width: 297mm; height: 210mm; padding: 9mm 11mm; page-break-after: always; display: flex; flex-direction: column; gap: 4mm; overflow: hidden; background: #f4f6fc }
.cover { justify-content: center; padding: 18mm 22mm; background: #0b1230; color: #f4f6fc }
.cover .brand { display: flex; align-items: center; gap: 4mm; margin-bottom: 8mm; font-size: 14pt; font-weight: 700 }
.cover .brand i { width: 11mm; height: 11mm; border-radius: 2.5mm; background: #1e4fd8; display: inline-block }
.cover h1 { font-size: 36pt; margin: 0 0 5mm; font-weight: 700; letter-spacing: -.5px; line-height: 1.1 }
.cover p { font-size: 12.5pt; max-width: 205mm; line-height: 1.55; margin: 0 0 2.5mm; color: #c9d2e6 }
.cover .legend { display: flex; gap: 3mm; margin-top: 8mm; flex-wrap: wrap }
.cover .legend span { padding: 1.8mm 4mm; border-radius: 99px; background: #ffffff; color: #0b1230; font-size: 10.5pt; font-weight: 600; border-left: 5mm solid }
.cover .how { margin-top: 5mm; color: #f4f6fc } .cover .how .num { display: inline-block; vertical-align: middle; margin-right: 2mm }
.idx { padding: 10mm 12mm }
.idx h2 { margin: 0 0 5mm; font-size: 20pt; letter-spacing: -.3px }
.idx-wrap { columns: 3; column-gap: 8mm; font-size: 9pt }
.idx-role { break-inside: avoid; margin-bottom: 4mm }
.idx-role h3 { margin: 0 0 1.5mm; font-size: 11pt }
.idx-role ul { list-style: none; margin: 0; padding: 0 }
.idx-role li { border-bottom: .2mm solid #dde3f2; padding: .8mm 0 }
.idx-role a { color: inherit; text-decoration: none } .idx-role b { color: #56617f; font-weight: 600; margin-right: 1.5mm }
.gloss { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3.5mm 7mm; margin: 0; font-size: 8.8pt; line-height: 1.4 }
.gloss dt { font-weight: 700; color: #1e4fd8; margin-bottom: .5mm } .gloss dd { margin: 0; color: #424c6b }
.lead { font-size: 10.5pt; color: #424c6b; max-width: 230mm; margin: 0 0 6mm; line-height: 1.5 } .lead.small { margin-top: 6mm; font-size: 9.5pt }
.key { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 10mm }
.kc { display: flex; gap: 4mm; align-items: center; background: #ffffff; border-radius: 3mm; padding: 3.5mm 4mm; box-shadow: 0 0 0 .3mm #dde3f2 }
.sw { width: 16mm; height: 9mm; border-radius: 1.2mm; flex: none; display: grid; place-items: center; font-weight: 700; font-size: 13pt }
.kc strong { display: block; font-size: 11pt } .kc span { color: #424c6b; font-size: 9pt; line-height: 1.4 }
.day header { margin-bottom: 5mm }
.flow { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4mm }
.flow li { display: flex; align-items: center; gap: 5mm; padding: 4mm 5mm; background: #ffffff; border-radius: 3mm; box-shadow: 0 0 0 .3mm #dde3f2; position: relative }
.flow li:not(:last-child)::after { content: "▼"; position: absolute; left: 11mm; bottom: -4.6mm; font-size: 8pt; color: #a7b0c4; background: #f4f6fc; line-height: 1 }
.flow a { color: #fff; background: #0b1230; border-radius: 2mm; padding: 1.5mm 3mm; text-decoration: none; font-size: 12pt }
.flow strong { display: block; font-size: 13pt } .flow span { color: #424c6b; font-size: 10.5pt }
.app-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; align-items: start }
.app { border-collapse: collapse; width: 100%; font-size: 8pt; line-height: 1.25 } .app th, .app td { border-bottom: .2mm solid #dde3f2; padding: 1mm 2mm; text-align: left } .app th { color: #56617f; font-size: 7.6pt; font-weight: 600 }
header { display: flex; align-items: center; gap: 4mm }
.code { color: #fff; font-weight: 700; font-size: 13pt; padding: 1.5mm 3.2mm; border-radius: 2mm }
.titles h2 { margin: 0; font-size: 20pt; line-height: 1.1; letter-spacing: -.3px } .titles small { font-size: 11pt; color: #56617f; font-weight: 400 }
.meta { margin-left: auto }
.role { border: .35mm solid; border-radius: 99px; padding: .6mm 3mm; font-size: 9pt; font-weight: 600; background: #ffffff }
code { font-family: Consolas, monospace; font-size: 8pt; color: #424c6b }
.shots { display: flex; gap: 5mm; align-items: flex-start; flex: 1; min-height: 0 }
figure { margin: 0 } figcaption { font-size: 7.5pt; color: #56617f; text-align: center; margin-top: 1mm; font-weight: 600 }
.desk img { width: 188mm; height: auto; display: block; border-radius: 2mm; box-shadow: 0 0 0 .3mm #bcc6e0, 0 1mm 3mm rgba(11,18,48,.1) }
.desk.wide img { width: 260mm }
.desk.narrow img { width: 110mm }
.mob img { height: 113mm; width: auto; display: block; border-radius: 4mm; border: .6mm solid #0b1230; box-shadow: 0 1mm 3mm rgba(11,18,48,.18) }
.info { display: grid; grid-template-columns: 1.4fr 1fr 1.1fr; gap: 6mm; font-size: 9pt; line-height: 1.42 }
.info.two { grid-template-columns: 1fr 1.6fr }
.info h4 { margin: 0 0 1mm; font-size: 8pt; font-weight: 700; color: #56617f }
.info p { margin: 0 0 1mm } .info .from { color: #0b1230; margin-top: 1.5mm }
.info .note { color: #6b3a00; background: #fbefdc; border-radius: 1.5mm; padding: 1mm 2mm; font-size: 8.3pt }
.info ul { margin: 0; padding: 0; list-style: none } .info li { margin-bottom: .8mm; display: flex; gap: 2mm; align-items: flex-start }
.info li.plain::before { content: "•"; width: 5mm; text-align: center; flex: none; color: #a7b0c4 }
.fxt { border-collapse: collapse; width: 100%; font-size: 8pt; line-height: 1.32; background: #ffffff; border-radius: 2mm; overflow: hidden; box-shadow: 0 0 0 .3mm #dde3f2 }
.fxt th { text-align: left; font-size: 7.4pt; color: #56617f; font-weight: 600; padding: 1.6mm 2.2mm; border-bottom: .3mm solid #dde3f2; background: #f4f6fc }
.fxt td { padding: 1.5mm 2.2mm; border-bottom: .2mm solid #dde3f2; vertical-align: top; color: #424c6b }
.fxt td:first-child { width: 36mm; color: #0b1230 } .fxt td:nth-child(2) { width: 44mm } .fxt td:nth-child(3) { width: 14mm } .fxt td:last-child { width: 46mm }
.fxt code { font-size: 7.4pt; color: #15348f }
.scr { display: inline-block; background: #0b1230; color: #fff; border-radius: 1mm; padding: .2mm 1.2mm; font-size: 7pt; font-weight: 700 }
.howgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; margin-top: 5mm; font-size: 8.3pt; line-height: 1.42; color: #424c6b }
.howgrid h4 { margin: 0 0 1mm; font-size: 9pt; color: #0b1230 } .howgrid p { margin: 0 } .howgrid code { font-size: 7.6pt; color: #15348f }
.small-lead { margin-bottom: 3mm; font-size: 9pt }
.frows { display: flex; flex-direction: column; gap: 4mm; flex: 1; min-height: 0 }
.fr { flex: 1; min-height: 0; display: flex; flex-direction: column; margin: 0 }
.fr figcaption { text-align: left; font-size: 7.8pt; color: #424c6b; line-height: 1.3; margin: 0 0 1.6mm }
.fr .frt { color: #0b1230; font-size: 9pt; margin-right: 1mm }
.fr .frc { margin-left: 1mm }
.steps { flex: 1; min-height: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 3mm }
.st { display: flex; flex-direction: column; min-height: 0; min-width: 0 }
.sti { flex: 1; min-height: 0; border-radius: 1.6mm; overflow: hidden; background: #e3e8f4; box-shadow: 0 0 0 .3mm #bcc6e0; display: flex; align-items: center; justify-content: center }
.sti img { width: 100%; height: 100%; object-fit: contain; display: block }
.stl { font-size: 7.6pt; color: #2b3456; margin-top: 1.2mm; display: flex; align-items: center; gap: 1.2mm }
.stl i { font-style: normal; font-weight: 700; flex: none; display: inline-grid; place-items: center; width: 3.8mm; height: 3.8mm; border-radius: 50%; background: #1e4fd8; color: #fff; font-size: 6.6pt }
.chip { display: inline-block; border: .3mm solid #1e4fd8; color: #15348f; border-radius: 99px; padding: 0 1.8mm; font-size: 7.2pt; font-weight: 600; margin: 0 .6mm }
.fxline { margin: 0; font-size: 8pt; color: #424c6b; background: #ffffff; border-radius: 1.5mm; padding: 1.2mm 2.5mm; box-shadow: 0 0 0 .3mm #dde3f2 }
.fxline i { color: #56617f }
.num { background: #e11d74; color: #fff; width: 5mm; height: 5mm; flex: none; border-radius: 50%; text-align: center; font: 700 8pt/5mm Arial }
</style></head><body>
<section class="page cover">
  <div class="brand"><i></i>Arena3</div>
  <h1>Từ điển màn hình</h1>
  <p>Ảnh chụp thật của từng màn hình trong giao diện hiện tại (bản đã khôi phục hiệu ứng và style gốc, tháng 10/2026), bằng tiếng Việt, kèm lời giải thích: màn hình để làm gì, ai dùng, vào bằng đâu, và làm được gì ở đó.</p>
  <p>Mỗi trang là một màn hình: bên trái là ảnh trên máy tính (1440×900), bên phải là ảnh trên điện thoại (390×844). Màn nào cần xem thêm có một trang tiếp theo. Tên người, gói và giá là dữ liệu mẫu, nên vẫn có chỗ còn tiếng Anh.${shootNote}</p>
  <p class="how"><b class="num">1</b> Số hồng trên ảnh chỉ đúng nút được nhắc ở cột «Làm được gì ở đây».</p>
  <p>${S.length} màn hình, ${Object.keys(ROLES).length} nhóm người dùng.</p>
  <div class="legend">${Object.values(ROLES).map((r) => `<span style="border-left-color:${r.color}">${r.vn}</span>`).join("")}</div>
</section>
<section class="page idx"><h2>Mục lục</h2><div class="idx-wrap">${index}</div></section>
${glossary}
${gridKey}
${days}
${gsapPages}
${pages}
${moreMenus}
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
