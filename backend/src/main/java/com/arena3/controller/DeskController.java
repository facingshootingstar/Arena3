package com.arena3.controller;

import com.arena3.entity.PriceRuleEntity;
import com.arena3.entity.UserEntity;
import com.arena3.security.SecurityUtils;
import com.arena3.service.DeskService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/v1")
public class DeskController {

    private final DeskService deskService;

    public DeskController(DeskService deskService) {
        this.deskService = deskService;
    }

    @GetMapping("/price-rules")
    public ResponseEntity<?> getPriceRules() {
        List<PriceRuleEntity> rules = deskService.getPriceRules();
        return ResponseEntity.ok(Map.of("items", rules));
    }

    @PostMapping("/shifts/open")
    public ResponseEntity<?> openShift() {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(deskService.openShift(user));
    }

    @GetMapping("/shifts/current")
    public ResponseEntity<?> getCurrentShift() {
        UserEntity user = SecurityUtils.requireCurrentUser();
        com.arena3.entity.CashierShiftEntity shift = deskService.getCurrentShift(user);
        Map<String, Object> res = new LinkedHashMap<>();
        if (shift != null) {
            res.put("shift", shift);
            res.put("totals", Map.of("cash", 0));
        }
        return ResponseEntity.ok(res);
    }

    @PutMapping("/price-rules")
    public ResponseEntity<?> replacePriceRules(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        List<PriceRuleEntity> rules = deskService.replacePriceRules(items, user);
        return ResponseEntity.ok(Map.of("items", rules));
    }

    @PostMapping("/shifts/{id}/close")
    public ResponseEntity<?> closeShift(@PathVariable("id") java.util.UUID id, @RequestBody(required = false) Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(deskService.closeShift(id, body, user));
    }

    @GetMapping("/reports/revenue")
    public ResponseEntity<?> getRevenueReport(@RequestParam(value = "from", required = false) String from,
                                             @RequestParam(value = "to", required = false) String to) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(deskService.getRevenueReport(from, to, user));
    }

    @GetMapping("/reports/occupancy")
    public ResponseEntity<?> getOccupancyReport(@RequestParam(value = "from", required = false) String from,
                                                @RequestParam(value = "to", required = false) String to) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(deskService.getOccupancyReport(from, to, user));
    }

    @GetMapping("/settings")
    public ResponseEntity<?> getSettings() {
        return ResponseEntity.ok(deskService.getSettings());
    }

    @PatchMapping("/settings")
    public ResponseEntity<?> patchSettings(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(deskService.patchSettings(body, user));
    }

    @GetMapping("/audit")
    public ResponseEntity<?> getAudit() {
        return ResponseEntity.ok(deskService.getAudit());
    }

    @PostMapping("/payments")
    public ResponseEntity<?> createPayment(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(deskService.createPayment(body, user));
    }

    @GetMapping(value = "/invoices/{id}.pdf", produces = "application/pdf")
    public ResponseEntity<byte[]> getInvoicePdf(@PathVariable("id") java.util.UUID id) {
        byte[] pdf = deskService.generateInvoicePdf(id);
        return ResponseEntity.ok()
                .header("Content-Disposition", "inline; filename=\"INV-" + id + ".pdf\"")
                .body(pdf);
    }
}
