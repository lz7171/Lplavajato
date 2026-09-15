CREATE TABLE IF NOT EXISTS agendamentos (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  veiculo TEXT NOT NULL,
  servico_id TEXT,
  data_agendamento DATE NOT NULL,
  horario TEXT NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
