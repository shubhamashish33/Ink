package com.shubham.ink;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.shubham.ink.security.RateLimitProperties;

@SpringBootApplication
@EnableConfigurationProperties(RateLimitProperties.class)
public class InkApplication {

	public static void main(String[] args) {
		SpringApplication.run(InkApplication.class, args);
	}

}
