import os

BASE = os.path.dirname(os.path.abspath(__file__))
JAVA = os.path.join(BASE, "src", "main", "java", "com", "arena3")

def w(path, content):
    p = os.path.join(JAVA, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print("Wrote:", path)

w("controller/AuthController.java", """
package com.arena3.controller;

import com.arena3.entity.UserEntity;
import com.arena3.security.SecurityUtils;
import com.arena3.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/v1")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String login = body.get("login");
        String password = body.get("password");
        Map<String, Object> resp = authService.login(login, password);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/auth/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> body) {
        Map<String, Object> resp = authService.register(body);
        return ResponseEntity.status(202).body(resp);
    }

    @PostMapping("/auth/otp/verify")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, Object> body) {
        Map<String, Object> resp = authService.verifyOtp(body);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader != null && authHeader.toLowerCase().startsWith("bearer ")) {
            authService.logout(authHeader.substring(7).trim());
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe() {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(authService.getMe(user));
    }

    @PatchMapping("/me")
    public ResponseEntity<?> patchMe(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(authService.patchMe(user, body));
    }
}
""")

w("controller/CourtBookingController.java", """
package com.arena3.controller;

import com.arena3.entity.CourtEntity;
import com.arena3.entity.UserEntity;
import com.arena3.security.SecurityUtils;
import com.arena3.service.CourtBookingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class CourtBookingController {

    private final CourtBookingService courtBookingService;

    public CourtBookingController(CourtBookingService courtBookingService) {
        this.courtBookingService = courtBookingService;
    }

    @GetMapping("/courts")
    public ResponseEntity<?> getCourts() {
        List<CourtEntity> courts = courtBookingService.getCourts();
        return ResponseEntity.ok(Map.of("items", courts));
    }

    @GetMapping("/occupancy")
    public ResponseEntity<?> getOccupancy(@RequestParam(value = "date", required = false) String date) {
        return ResponseEntity.ok(courtBookingService.getOccupancy(date));
    }

    @PostMapping("/bookings")
    public ResponseEntity<?> holdBooking(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.getCurrentUser();
        Map<String, Object> res = courtBookingService.holdBooking(body, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    @PostMapping("/bookings/{id}/cancel")
    public ResponseEntity<?> cancelBooking(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.getCurrentUser();
        Map<String, Object> res = courtBookingService.cancelBooking(id, user);
        return ResponseEntity.ok(res);
    }
}
""")

w("controller/PlanController.java", """
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

@RestController
@RequestMapping("/v1")
public class PlanController {

    private final PlanService planService;

    public PlanController(PlanService planService) {
        this.planService = planService;
    }

    @GetMapping("/plans")
    public ResponseEntity<?> getPlans() {
        List<MembershipPlanEntity> list = planService.getPlans();
        return ResponseEntity.ok(Map.of("items", list));
    }

    @PostMapping("/plans")
    public ResponseEntity<?> createPlan(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        MembershipPlanEntity p = planService.createPlan(body, user);
        return ResponseEntity.ok(p);
    }

    @PostMapping("/subscriptions")
    public ResponseEntity<?> createSubscription(@RequestBody Map<String, Object> body) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        SubscriptionEntity s = planService.createSubscription(body, user);
        return ResponseEntity.ok(s);
    }
}
""")

w("controller/ClassController.java", """
package com.arena3.controller;

import com.arena3.entity.UserEntity;
import com.arena3.security.SecurityUtils;
import com.arena3.service.ClassService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class ClassController {

    private final ClassService classService;

    public ClassController(ClassService classService) {
        this.classService = classService;
    }

    @GetMapping("/classes")
    public ResponseEntity<?> getClasses() {
        UserEntity user = SecurityUtils.getCurrentUser();
        List<Map<String, Object>> list = classService.getClasses(user);
        return ResponseEntity.ok(Map.of("items", list));
    }

    @GetMapping("/coach/schedule")
    public ResponseEntity<?> getCoachSchedule() {
        UserEntity user = SecurityUtils.requireCurrentUser();
        List<Map<String, Object>> schedule = classService.getCoachSchedule(user);
        return ResponseEntity.ok(Map.of("items", schedule));
    }

    @PostMapping("/classes/{id}/enroll")
    public ResponseEntity<?> enroll(@PathVariable("id") UUID id) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(classService.enroll(id, user));
    }
}
""")

w("controller/DeskController.java", """
package com.arena3.controller;

import com.arena3.entity.PriceRuleEntity;
import com.arena3.entity.UserEntity;
import com.arena3.security.SecurityUtils;
import com.arena3.service.DeskService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
        return ResponseEntity.ok(deskService.getCurrentShift(user));
    }

    @GetMapping("/reports/revenue")
    public ResponseEntity<?> getRevenueReport(@RequestParam(value = "from", required = false) String from,
                                             @RequestParam(value = "to", required = false) String to) {
        UserEntity user = SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(deskService.getRevenueReport(from, to, user));
    }

    @GetMapping("/settings")
    public ResponseEntity<?> getSettings() {
        return ResponseEntity.ok(deskService.getSettings());
    }

    @GetMapping("/audit")
    public ResponseEntity<?> getAudit() {
        return ResponseEntity.ok(deskService.getAudit());
    }
}
""")

w("controller/MemberController.java", """
package com.arena3.controller;

import com.arena3.service.MemberService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class MemberController {

    private final MemberService memberService;

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @GetMapping("/members")
    public ResponseEntity<?> searchMembers(@RequestParam(value = "q", required = false) String q) {
        return ResponseEntity.ok(Map.of("items", memberService.searchMembers(q)));
    }

    @GetMapping("/members/{id}")
    public ResponseEntity<?> getMember(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(memberService.getMember(id));
    }
}
""")

w("controller/OpsController.java", """
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

    @GetMapping("/equipment")
    public ResponseEntity<?> getEquipment() {
        return ResponseEntity.ok(Map.of("items", opsService.getEquipment()));
    }

    @PostMapping("/assistant")
    public ResponseEntity<?> chatAssistant(@RequestBody Map<String, String> body) {
        String message = body.get("message");
        return ResponseEntity.ok(opsService.chatAssistant(message));
    }
}
""")

print("Done writing controllers!")
