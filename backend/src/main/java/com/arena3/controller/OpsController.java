package com.arena3.controller;

import com.arena3.service.OpsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/v1")
public class OpsController {

    private final OpsService opsService;

    public OpsController(OpsService opsService) {
        this.opsService = opsService;
    }

    @GetMapping("/flags")
    public ResponseEntity<?> getFlags() {
        return ResponseEntity.ok(Map.of("flags", opsService.getFlags()));
    }

    @PatchMapping("/flags")
    public ResponseEntity<?> patchFlags(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("flags", opsService.updateFlags(body)));
    }

    @GetMapping("/equipment")
    public ResponseEntity<?> getEquipment() {
        return ResponseEntity.ok(Map.of("items", opsService.getEquipment()));
    }

    @GetMapping("/equipment/loans")
    public ResponseEntity<?> getEquipmentLoans() {
        return ResponseEntity.ok(Map.of("items", opsService.getEquipmentLoans()));
    }

    @PostMapping("/equipment/loans")
    public ResponseEntity<?> loanEquipment(@RequestBody Map<String, Object> body) {
        com.arena3.entity.UserEntity user = com.arena3.security.SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(opsService.loanEquipment(body, user));
    }

    @PostMapping("/equipment/loans/{id}/return")
    public ResponseEntity<?> returnEquipment(@PathVariable("id") java.util.UUID id) {
        com.arena3.entity.UserEntity user = com.arena3.security.SecurityUtils.requireCurrentUser();
        opsService.returnEquipment(id, user);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/tickets")
    public ResponseEntity<?> getTickets() {
        return ResponseEntity.ok(Map.of("items", opsService.getTickets()));
    }

    @PostMapping("/tickets/{id}/close")
    public ResponseEntity<?> closeTicket(@PathVariable("id") java.util.UUID id) {
        opsService.closeTicket(id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/training-plans")
    public ResponseEntity<?> getTrainingPlans(@RequestParam(value = "mine", required = false) String mine) {
        com.arena3.entity.UserEntity user = com.arena3.security.SecurityUtils.getCurrentUser();
        return ResponseEntity.ok(Map.of("items", opsService.getTrainingPlans(user, mine)));
    }

    @PostMapping("/training-plans/suggest")
    public ResponseEntity<?> suggestTrainingPlan(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(opsService.suggestTrainingPlan(body));
    }

    @PostMapping("/assistant")
    public ResponseEntity<?> chatAssistant(@RequestBody Map<String, String> body) {
        String message = body.get("message");
        return ResponseEntity.ok(opsService.chatAssistant(message));
    }

    @PostMapping("/inquiry")
    public ResponseEntity<?> createInquiry(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(opsService.createInquiry(body));
    }
}
