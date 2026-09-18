package com.arena3.service;

import com.arena3.entity.EquipmentItemEntity;
import com.arena3.entity.FeatureFlagEntity;
import com.arena3.repository.EquipmentItemRepository;
import com.arena3.repository.FeatureFlagRepository;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class OpsService {

    private final FeatureFlagRepository featureFlagRepository;
    private final EquipmentItemRepository equipmentItemRepository;
    private final com.arena3.repository.EquipmentLoanRepository equipmentLoanRepository;
    private final com.arena3.repository.TicketRepository ticketRepository;
    private final com.arena3.repository.TrainingPlanRepository trainingPlanRepository;
    private final com.arena3.repository.UserRepository userRepository;

    public OpsService(FeatureFlagRepository featureFlagRepository,
                      EquipmentItemRepository equipmentItemRepository,
                      com.arena3.repository.EquipmentLoanRepository equipmentLoanRepository,
                      com.arena3.repository.TicketRepository ticketRepository,
                      com.arena3.repository.TrainingPlanRepository trainingPlanRepository,
                      com.arena3.repository.UserRepository userRepository) {
        this.featureFlagRepository = featureFlagRepository;
        this.equipmentItemRepository = equipmentItemRepository;
        this.equipmentLoanRepository = equipmentLoanRepository;
        this.ticketRepository = ticketRepository;
        this.trainingPlanRepository = trainingPlanRepository;
        this.userRepository = userRepository;
    }

    public Map<String, Boolean> getFlags() {
        Map<String, Boolean> res = new LinkedHashMap<>();
        List<FeatureFlagEntity> list = featureFlagRepository.findAll();
        for (FeatureFlagEntity f : list) {
            res.put(f.getKey(), f.isEnabled());
        }
        return res;
    }

    @org.springframework.transaction.annotation.Transactional
    public Map<String, Boolean> updateFlags(Map<String, Object> updates) {
        for (Map.Entry<String, Object> e : updates.entrySet()) {
            String key = e.getKey();
            boolean val = Boolean.parseBoolean(String.valueOf(e.getValue()));
            FeatureFlagEntity flag = featureFlagRepository.findById(key)
                    .orElse(new FeatureFlagEntity(key, val));
            flag.setEnabled(val);
            featureFlagRepository.save(flag);
        }
        return getFlags();
    }

    public List<EquipmentItemEntity> getEquipment() {
        return equipmentItemRepository.findAll();
    }

    public Map<String, Object> chatAssistant(String message) {
        Map<String, Object> res = new LinkedHashMap<>();
        String lower = message != null ? message.toLowerCase() : "";
        if (lower.contains("giờ") || lower.contains("mở cửa")) {
            res.put("reply", "Arena3 mở cửa từ 06:00 đến 22:00 tất cả các ngày trong tuần.");
        } else if (lower.contains("giá")) {
            res.put("reply", "Giá sân dao động từ 80.000đ đến 140.000đ/giờ cho sân cầu lông tùy khung giờ cao điểm.");
        }
        res.put("source", "rule");
        return res;
    }

    public List<Map<String, Object>> getTickets() {
        List<com.arena3.entity.TicketEntity> list = ticketRepository.findAll();
        List<Map<String, Object>> res = new ArrayList<>();
        for (com.arena3.entity.TicketEntity t : list) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId().toString());
            m.put("body", t.getBody());
            m.put("status", t.getStatus());
            m.put("created_at", t.getCreatedAt().toString());
            if (t.getUserId() != null) {
                userRepository.findById(t.getUserId()).ifPresent(u -> {
                    m.put("full_name", u.getFullName());
                    m.put("phone", u.getPhone());
                });
            } else {
                m.put("full_name", null);
                m.put("phone", null);
            }
            res.add(m);
        }
        return res;
    }

    @org.springframework.transaction.annotation.Transactional
    public void closeTicket(UUID id) {
        ticketRepository.findById(id).ifPresent(t -> {
            t.setStatus("closed");
            ticketRepository.save(t);
        });
    }

    public List<Map<String, Object>> getEquipmentLoans() {
        List<com.arena3.entity.EquipmentLoanEntity> list = equipmentLoanRepository.findAll();
        List<Map<String, Object>> res = new ArrayList<>();
        for (com.arena3.entity.EquipmentLoanEntity l : list) {
            if ("out".equalsIgnoreCase(l.getStatus())) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", l.getId().toString());
                m.put("item_id", l.getItemId().toString());
                m.put("phone", l.getPhone());
                m.put("qty", l.getQty());
                m.put("status", l.getStatus());
                m.put("due_at", l.getDueAt().toString());
                m.put("returned_at", l.getReturnedAt() != null ? l.getReturnedAt().toString() : null);
                equipmentItemRepository.findById(l.getItemId()).ifPresent(it -> m.put("name", it.getName()));
                res.add(m);
            }
        }
        return res;
    }

    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> loanEquipment(Map<String, Object> body, com.arena3.entity.UserEntity user) {
        UUID itemId = UUID.fromString((String) body.get("item_id"));
        String phone = (String) body.get("phone");
        int qty = ((Number) body.getOrDefault("qty", 1)).intValue();

        com.arena3.entity.EquipmentItemEntity item = equipmentItemRepository.findById(itemId)
                .orElseThrow(() -> com.arena3.exception.ApiException.notFound("Không tìm thấy dụng cụ."));

        com.arena3.entity.EquipmentLoanEntity loan = new com.arena3.entity.EquipmentLoanEntity();
        loan.setItemId(itemId);
        loan.setPhone(phone);
        loan.setQty(qty);
        loan.setStatus("out");
        loan.setDueAt(java.time.OffsetDateTime.now().plusHours(2));
        equipmentLoanRepository.save(loan);

        return Map.of("rent_vnd", item.getRentVnd() * qty);
    }

    @org.springframework.transaction.annotation.Transactional
    public void returnEquipment(UUID loanId, com.arena3.entity.UserEntity user) {
        equipmentLoanRepository.findById(loanId).ifPresent(l -> {
            l.setStatus("returned");
            l.setReturnedAt(java.time.OffsetDateTime.now());
            equipmentLoanRepository.save(l);
        });
    }

    public List<Map<String, Object>> getTrainingPlans(com.arena3.entity.UserEntity user, String mine) {
        List<com.arena3.entity.TrainingPlanEntity> list = trainingPlanRepository.findAll();
        List<Map<String, Object>> res = new ArrayList<>();
        for (com.arena3.entity.TrainingPlanEntity p : list) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId().toString());
            m.put("scope", p.getScope());
            m.put("source", p.getSource());
            m.put("payload", Map.of(
                "goal", "Kỹ thuật di chuyển và thể lực cơ bản",
                "blocks", List.of(
                    Map.of("title", "Khởi động & ép dẻo", "minutes", 15),
                    Map.of("title", "Bước chân di chuyển 6 góc sân", "minutes", 30),
                    Map.of("title", "Đập cầu và chụp lưới", "minutes", 30),
                    Map.of("title", "Thả lỏng cơ bắp", "minutes", 15)
                ),
                "note", "Tập trung giữ thăng bằng trọng tâm."
            ));
            res.add(m);
        }
        return res;
    }

    public Map<String, Object> suggestTrainingPlan(Map<String, Object> body) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("goal", "Gợi ý giáo án: Tăng cường tốc độ phản xạ và sức bền");
        payload.put("blocks", List.of(
            Map.of("title", "Khởi động nhanh & bước di chuyển", "minutes", 15),
            Map.of("title", "Bài tập phản xạ lưới", "minutes", 25),
            Map.of("title", "Thi đấu tình huống nửa sân", "minutes", 35),
            Map.of("title", "Giãn cơ phục hồi", "minutes", 15)
        ));
        payload.put("note", "HLV hãy duyệt trước khi áp dụng cho học viên.");
        return Map.of("payload", payload);
    }

    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> createInquiry(Map<String, String> body) {
        String name = body.getOrDefault("name", "");
        String phone = body.getOrDefault("phone", "");
        String sport = body.getOrDefault("sport", "");
        String message = body.getOrDefault("message", "");

        if (phone.isBlank()) {
            throw com.arena3.exception.ApiException.validation("Vui lòng nhập số điện thoại.");
        }

        String ticketBody = String.format("[Tư vấn từ trang chủ]\nTên: %s\nĐiện thoại: %s\nMôn quan tâm: %s\nLời nhắn: %s",
                name, phone, sport, message);

        com.arena3.entity.TicketEntity ticket = new com.arena3.entity.TicketEntity();
        ticket.setBody(ticketBody);
        ticketRepository.save(ticket);

        return Map.of("success", true, "ticket_id", ticket.getId().toString());
    }
}
