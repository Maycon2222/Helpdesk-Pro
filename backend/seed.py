from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import Comment, Ticket, TicketHistory, User

Base.metadata.create_all(bind=engine)

users_data = [
    ("Admin Sistema", "admin@helpdeskpro.com", "admin123", "admin"),
    ("Carlos Atendente", "carlos@helpdeskpro.com", "atend123", "attendant"),
    ("Ana Atendente", "ana@helpdeskpro.com", "atend123", "attendant"),
    ("João Solicitante", "joao@helpdeskpro.com", "user123", "requester"),
    ("Maria Solicitante", "maria@helpdeskpro.com", "user123", "requester"),
    ("Pedro Solicitante", "pedro@helpdeskpro.com", "user123", "requester"),
]

tickets_data = [
    ("VPN não conecta no Windows 11", "A VPN abre, mas não conclui a autenticação no notebook corporativo.", "Infraestrutura", "urgent", "open", -8),
    ("Impressora do RH offline", "A impressora de rede não aparece para os computadores do setor.", "Hardware", "high", "open", -30),
    ("Acesso ao sistema financeiro bloqueado", "Usuário recebe mensagem de perfil sem permissão ao entrar no financeiro.", "Acesso e permissões", "medium", "open", 50),
    ("Computador travando durante videoconferência", "O equipamento congela quando reuniões passam de 20 minutos.", "Hardware", "medium", "open", 60),
    ("Solicitar licença do Adobe Acrobat", "Preciso editar contratos em PDF com frequência durante a semana.", "Solicitação de serviço", "low", "in_progress", 90),
    ("E-mail corporativo não sincroniza no celular", "As mensagens chegam no desktop, mas não aparecem no aplicativo móvel.", "Software", "medium", "in_progress", 30),
    ("Erro ao gerar relatório no ERP", "Relatório mensal retorna erro 500 ao selecionar o centro de custo.", "Software", "high", "in_progress", 12),
    ("Troca de mouse sem fio", "Mouse apresenta falhas intermitentes e perda de conexão.", "Hardware", "low", "waiting", 80),
    ("Liberação de pasta compartilhada", "Solicito acesso à pasta de contratos da diretoria comercial.", "Acesso e permissões", "medium", "waiting", 40),
    ("Notebook novo para colaborador", "Equipamento para novo analista que inicia na próxima semana.", "Solicitação de serviço", "low", "resolved", 100),
    ("Atualização de navegador", "Sistema externo exige versão mais recente do navegador homologado.", "Software", "medium", "resolved", 70),
    ("Queda de rede no almoxarifado", "Ponto de rede oscila durante conferência de mercadorias.", "Infraestrutura", "high", "resolved", 30),
    ("Senha expirada sem aviso", "Conta solicitou troca de senha sem enviar notificação prévia.", "Acesso e permissões", "low", "resolved", 90),
    ("Configurar ramal temporário", "Solicitação cancelada porque o evento interno foi remarcado.", "Outros", "low", "cancelled", 100),
    ("Instalar monitor adicional", "Solicitação duplicada, já atendida por outro chamado.", "Hardware", "medium", "cancelled", 60),
]


def main() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == "admin@helpdeskpro.com")):
            print("Seed já executado.")
            return

        users = {}
        for name, email, password, role in users_data:
            user = User(name=name, email=email, password_hash=hash_password(password), role=role, is_active=True)
            db.add(user)
            users[email] = user
        db.flush()

        requesters = [users["joao@helpdeskpro.com"], users["maria@helpdeskpro.com"], users["pedro@helpdeskpro.com"]]
        attendants = [users["carlos@helpdeskpro.com"], users["ana@helpdeskpro.com"]]
        admin = users["admin@helpdeskpro.com"]
        now = datetime.now(timezone.utc)

        for index, (title, description, category, priority, status, hours_until_sla) in enumerate(tickets_data, start=1):
            requester = requesters[index % len(requesters)]
            assignee = attendants[index % len(attendants)] if status in {"in_progress", "waiting", "resolved"} else None
            ticket = Ticket(
                code=f"CHM-{index:06d}",
                title=title,
                description=description,
                category=category,
                priority=priority,
                status=status,
                requester=requester,
                assignee=assignee,
                sla_deadline=now + timedelta(hours=hours_until_sla),
                resolved_at=now - timedelta(hours=4) if status == "resolved" else None,
                created_at=now - timedelta(days=index),
            )
            db.add(ticket)
            db.flush()
            db.add(Comment(ticket=ticket, author=requester, content="Chamado aberto com as informações necessárias para análise.", is_internal=False))
            db.add(Comment(ticket=ticket, author=assignee or admin, content="Triagem realizada e próximo passo registrado.", is_internal=status in {"in_progress", "waiting"}))
            db.add(TicketHistory(ticket=ticket, changed_by=requester, field_changed="creation", old_value=None, new_value=ticket.code, description=f"Chamado {ticket.code} criado"))
            db.add(TicketHistory(ticket=ticket, changed_by=assignee or admin, field_changed="status", old_value="open", new_value=status, description=f"Status definido como {status}"))

        db.commit()
        print("Seed executado com sucesso.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
