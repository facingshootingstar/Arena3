package com.arena3.security;

import com.arena3.entity.SessionAuthEntity;
import com.arena3.entity.UserEntity;
import com.arena3.repository.SessionAuthRepository;
import com.arena3.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.Optional;

@Component
public class TokenAuthenticationFilter extends OncePerRequestFilter {

    private final SessionAuthRepository sessionAuthRepository;
    private final UserRepository userRepository;

    public TokenAuthenticationFilter(SessionAuthRepository sessionAuthRepository, UserRepository userRepository) {
        this.sessionAuthRepository = sessionAuthRepository;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.toLowerCase().startsWith("bearer ")) {
            String token = authHeader.substring(7).trim();
            String tokenHash = SecurityUtils.sha256(token);

            Optional<SessionAuthEntity> sessionOpt = sessionAuthRepository.findByTokenHash(tokenHash);
            if (sessionOpt.isPresent()) {
                SessionAuthEntity session = sessionOpt.get();
                if (session.getExpiresAt().isAfter(OffsetDateTime.now())) {
                    Optional<UserEntity> userOpt = userRepository.findById(session.getUserId());
                    if (userOpt.isPresent() && "active".equalsIgnoreCase(userOpt.get().getStatus())) {
                        UserEntity user = userOpt.get();
                        String roleName = "ROLE_" + user.getRole().toUpperCase();
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                user,
                                null,
                                Collections.singletonList(new SimpleGrantedAuthority(roleName))
                        );
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
