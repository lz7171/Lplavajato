-- Tabela de leads (formulário de contato)
CREATE TABLE IF NOT EXISTS leads (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  message    TEXT NOT NULL,
  status     VARCHAR(20)  NOT NULL DEFAULT 'novo',
  ip_hash    CHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_leads_created (created_at),
  INDEX idx_leads_ip (ip_hash, created_at)
) DEFAULT CHARSET=utf8mb4;
