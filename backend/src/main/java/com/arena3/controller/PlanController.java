package com.arena3.controller;

import com.arena3.entity.MembershipPlanEntity;
import com.arena3.entity.SubscriptionEntity;
import com.arena3.entity.UserEntity;
import com.arena3.security.SecurityUtils;
import com.arena3.service.PlanService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class PlanController {

    private final PlanService planService;

    public PlanController(PlanService planService) {
        this.planService = planService;
    }

    @GetMapping("/plans")
    public ResponseEntity<?> getPlans() {
        UserEntity user = SecurityUtils.getCurrentUser();
        List<MembershipPlanEntity> list = planService.getPlans(user);
        return ResponseEntity.ok(Map.of("items", list));
    }

    @PostMapping("/plans")
    public ResponseEntity<?> createPlan(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        MembershipPlanEntity p = planService.createPlan(body, user);
        return ResponseEntity.ok(p);
    }

    @PatchMapping("/plans/{id}")
    public ResponseEntity<?> patchPlan(@PathVariable("id") UUID id, @RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        MembershipPlanEntity p = planService.patchPlan(id, body, user);
        return ResponseEntity.ok(p);
    }

    @PostMapping("/subscriptions")
    public ResponseEntity<?> createSubscription(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        SubscriptionEntity s = planService.createSubscription(body, user);
        Map<String, Object> res = new java.util.LinkedHashMap<>();
        res.put("subscription", s);
        res.put("id", s.getId().toString());
        res.put("preview_end", s.getEndOn() != null ? s.getEndOn().toString() : "");
        res.put("renewal", false);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(res);
    }

    @PostMapping("/subscriptions/{id}/freeze")
    public ResponseEntity<?> freezeSubscription(@PathVariable("id") UUID id, @RequestBody(required = false) Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        int days = body != null && body.get("days") != null ? ((Number) body.get("days")).intValue() : 7;
        SubscriptionEntity s = planService.freezeSubscription(id, days, user);
        return ResponseEntity.ok(Map.of("subscription", s));
    }

    @PostMapping("/subscriptions/{id}/unfreeze")
    public ResponseEntity<?> unfreezeSubscription(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        SubscriptionEntity s = planService.unfreezeSubscription(id, user);
        return ResponseEntity.ok(Map.of("subscription", s));
    }
}
