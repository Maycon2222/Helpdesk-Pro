## HelpDesk Pro

### Sobre o projeto
HelpDesk Pro é um sistema web isolado para gestão de chamados internos. Ele permite abertura de chamados, controle de SLA, comentários, histórico automático, dashboard operacional e permissões por perfil. A aplicação foi criada do zero neste diretório, sem vínculo com qualquer sistema existente.

### Stack tecnológica
- Backend: FastAPI, SQLAlchemy 2, PostgreSQL, JWT, bcrypt
- Frontend: React 18, Vite, TypeScript, TailwindCSS, Zustand, Axios, Lucide
- Banco: PostgreSQL 15
- Infra: Docker e Docker Compose

### Pré-requisitos
- Docker e Docker Compose instalados

### Como executar

1. Entre na pasta do projeto:
   ```bash
   cd helpdesk-pro
   ```
2. Suba os containers:
   ```bash
   docker-compose up --build
   ```
3. Em outro terminal, execute o seed:
   ```bash
   docker-compose exec backend python seed.py
   ```
4. Acesse:
   ```text
   http://localhost:5173
   ```

### Credenciais de demonstração

| Nome | Email | Senha | Role |
|---|---|---|---|
| Admin Sistema | admin@helpdeskpro.com | admin123 | admin |
| Carlos Atendente | carlos@helpdeskpro.com | atend123 | attendant |
| Ana Atendente | ana@helpdeskpro.com | atend123 | attendant |
| João Solicitante | joao@helpdeskpro.com | user123 | requester |
| Maria Solicitante | maria@helpdeskpro.com | user123 | requester |
| Pedro Solicitante | pedro@helpdeskpro.com | user123 | requester |

### Estrutura do projeto
- `backend/app/core`: configuração, banco, segurança e dependências.
- `backend/app/models`: modelos SQLAlchemy.
- `backend/app/routers`: rotas de auth, usuários, chamados e dashboard.
- `backend/app/services`: regras de negócio compartilhadas.
- `frontend/src`: aplicação React com páginas, store, API client e componentes.

### Funcionalidades
- Login JWT com perfis admin, atendente e solicitante.
- CRUD operacional de chamados.
- Filtros por status, prioridade, categoria e busca textual.
- Controle de permissões por role.
- SLA calculado na criação e indicador visual de atraso.
- Comentários públicos e internos.
- Histórico automático de criação, alteração de status, prioridade, responsável e comentários.
- Dashboard com métricas principais.
- Gestão de usuários para admin.
- Seed com dados realistas.

### Decisões técnicas
- O sistema cria as tabelas no startup para facilitar demonstração local rápida.
- A separação backend/frontend é feita por serviços Docker independentes.
- UUIDs são usados nas entidades expostas pela API.
- O prazo de SLA é fixado na criação do chamado, conforme a regra do prompt.
- A UI prioriza densidade operacional, leitura rápida e ações diretas.

### Melhorias futuras
- Migrações Alembic versionadas para produção.
- Upload de anexos.
- Kanban de chamados.
- Refresh token e rate limiting.
- Notificações em tempo real.
