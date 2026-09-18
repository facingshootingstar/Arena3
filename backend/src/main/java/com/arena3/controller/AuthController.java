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
        if (login == null) login = body.get("identifier");
        if (login == null) login = body.get("phone");
        if (login == null) login = body.get("email");
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
