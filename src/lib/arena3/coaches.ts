import { media } from "./media";

export type CoachCard = {
  name: string;
  sport: string;
  title: string;
  blurb: string;
  creds: string[];
  photo: string;
};

/** Presentation copy for seeded HLV — not a new table. */
export const COACHES: CoachCard[] = [
  {
    name: "Nguyễn Minh Khoa",
    sport: "badminton",
    title: "HLV trưởng cầu lông",
    blurb:
      "Phụ trách lớp mới và nâng cao. Ưu tiên chân vị trí, smash có kiểm soát — không đốt vai học viên mới.",
    creds: ["Lớp mới T2/T4/T6 18:00", "Nâng cao T7 08:00", "Sân CL-01 · CL-05"],
    photo: media.coachKhoa,
  },
  {
    name: "Trần Thị Lan",
    sport: "badminton",
    title: "HLV cầu lông trung bình",
    blurb:
      "Trợ giảng lớp mới, chủ lớp trung bình. Kiên nhẫn với học viên vừa chuyển từ tự tập sang có giáo án.",
    creds: ["Trung bình T3/T5 19:00", "Trợ giảng lớp mới", "Sân CL-03"],
    photo: media.coachLan,
  },
  {
    name: "Phạm Đức Anh",
    sport: "basketball",
    title: "HLV trưởng bóng rổ",
    blurb:
      "Giáo án beginner trên BR-01: chân, nhả bóng, chơi nhóm. Sân convert — lịch lớp không đè slot đã bán.",
    creds: ["Lớp mới T2/T4 17:00", "Sân BR-01", "Sức bật · phối hợp"],
    photo: media.coachAnh,
  },
  {
    name: "Lê Quốc Việt",
    sport: "volleyball",
    title: "HLV trưởng bóng chuyền",
    blurb:
      "Trung bình trên BC-01. Tập đỡ bóng, phát, tư duy đội — phù hợp người đã chơi sân phủi muốn vào khung.",
    creds: ["Trung bình T7 16:00", "Sân BC-01", "Đội hình · phản xạ"],
    photo: media.coachViet,
  },
];
