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

    @PostMapping("/members")
    public ResponseEntity<?> createMember(@RequestBody Map<String, Object> body) {
        com.arena3.entity.UserEntity user = com.arena3.security.SecurityUtils.requireCurrentUser();
        return ResponseEntity.ok(memberService.createMember(body, user));
    }

    @GetMapping("/members/{id}")
    public ResponseEntity<?> getMember(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(memberService.getMember(id));
    }
}
