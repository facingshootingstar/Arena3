package com.arena3.security;

import org.bouncycastle.crypto.generators.SCrypt;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class ScryptPasswordEncoder implements PasswordEncoder {

    private static final int DEFAULT_N = 16384;
    private static final int DEFAULT_R = 8;
    private static final int DEFAULT_P = 1;
    private static final int KEY_LEN = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    public String encode(CharSequence rawPassword) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        String saltBase64 = Base64.getUrlEncoder().withoutPadding().encodeToString(salt);
        byte[] hash = SCrypt.generate(
                rawPassword.toString().getBytes(StandardCharsets.UTF_8),
                salt,
                DEFAULT_N,
                DEFAULT_R,
                DEFAULT_P,
                KEY_LEN
        );
        String hashBase64 = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        return String.format("scrypt$%d$%d$%d$%s$%s", DEFAULT_N, DEFAULT_R, DEFAULT_P, saltBase64, hashBase64);
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (encodedPassword == null || !encodedPassword.startsWith("scrypt$")) {
            return false;
        }
        String[] parts = encodedPassword.split("\\$");
        if (parts.length != 6) {
            return false;
        }
        try {
            int n = Integer.parseInt(parts[1]);
            int r = Integer.parseInt(parts[2]);
            int p = Integer.parseInt(parts[3]);
            byte[] salt = Base64.getUrlDecoder().decode(parts[4]);
            byte[] expectedHash = Base64.getUrlDecoder().decode(parts[5]);

            byte[] actualHash = SCrypt.generate(
                    rawPassword.toString().getBytes(StandardCharsets.UTF_8),
                    salt,
                    n,
                    r,
                    p,
                    expectedHash.length
            );

            return MessageDigest.isEqual(actualHash, expectedHash);
        } catch (Exception e) {
            return false;
        }
    }
}
