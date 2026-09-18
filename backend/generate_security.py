import os

BASE = os.path.dirname(os.path.abspath(__file__))
JAVA = os.path.join(BASE, "src", "main", "java", "com", "arena3")

def w(path, content):
    p = os.path.join(JAVA, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print("Wrote:", path)

w("security/SecurityUtils.java", """
package com.arena3.security;

import com.arena3.entity.UserEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.Base64;
import java.util.UUID;

public class SecurityUtils {
    private static final SecureRandom RANDOM = new SecureRandom();

    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 error", e);
        }
    }

    public static String randomToken(int bytes) {
        byte[] buf = new byte[bytes];
        RANDOM.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    public static String normalizePhone(String raw) {
        if (raw == null) return "";
        String s = raw.trim().replaceAll("[\\\\s.-]", "");
        if (s.startsWith("0")) s = "+84" + s.substring(1);
        else if (s.startsWith("84")) s = "+" + s;
        return s;
    }

    public static String unaccentVi(String input) {
        if (input == null) return "";
        String nfd = Normalizer.normalize(input, Normalizer.Form.NFD);
        return nfd.replaceAll("\\\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'd')
                .toLowerCase()
                .trim();
    }

    public static UserEntity getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserEntity) {
            return (UserEntity) auth.getPrincipal();
        }
        return null;
    }

    public static UserEntity requireCurrentUser() {
        UserEntity u = getCurrentUser();
        if (u == null) {
            throw com.arena3.exception.ApiException.unauth("Chưa đăng nhập.");
        }
        return u;
    }
}
""")

w("security/TokenAuthenticationFilter.java", """
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
""")

w("config/SecurityConfig.java", """
package com.arena3.config;

import com.arena3.security.TokenAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final TokenAuthenticationFilter tokenFilter;

    public SecurityConfig(TokenAuthenticationFilter tokenFilter) {
        this.tokenFilter = tokenFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(headers -> headers.frameOptions(frame -> frame.disable()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/h2-console/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/v1/auth/register", "/v1/auth/otp/verify", "/v1/auth/login", "/v1/auth/password/forgot").permitAll()
                .requestMatchers(HttpMethod.GET, "/v1/plans", "/v1/courts", "/v1/classes", "/v1/price-rules", "/v1/flags").permitAll()
                .requestMatchers("/v1/**").authenticated()
                .anyRequest().permitAll()
            )
            .addFilterBefore(tokenFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
""")

w("config/WebConfig.java", """
package com.arena3.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
""")

print("Security and config generated successfully!")
