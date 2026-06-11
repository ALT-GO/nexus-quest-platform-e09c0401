
create table public.email_templates(
  id uuid primary key default gen_random_uuid(),
  template_key text unique not null,
  enabled boolean not null default true,
  subject text not null,
  header_title text not null default 'Suporte TI — Grupo Orion',
  heading_title text not null,
  greeting text not null default '',
  body_html text not null,
  cta_label text not null default '',
  footer_text text not null default 'Este é um e-mail automático. Para dúvidas, responda esta mensagem.',
  font_family text not null default 'Arial, sans-serif',
  primary_color text not null default 'hsl(262, 83%, 58%)',
  from_address text not null default '',
  reply_to text not null default '',
  cc text not null default '',
  updated_at timestamptz not null default now()
);

grant select on public.email_templates to authenticated;
grant all on public.email_templates to service_role;

alter table public.email_templates enable row level security;

create policy "Authenticated read email_templates"
  on public.email_templates for select to authenticated using (true);

create policy "Admins update email_templates"
  on public.email_templates for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins insert email_templates"
  on public.email_templates for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.touch_email_templates_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;$$;

create trigger set_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.touch_email_templates_updated_at();

insert into public.email_templates(template_key, subject, heading_title, greeting, body_html, cta_label, from_address, reply_to, cc)
values
('ticket_created',
 '[{{ticket_number}}] Recebemos seu chamado',
 'Recebemos seu chamado, {{first_name}}!',
 '',
 '<p>Seu chamado foi registrado com sucesso e nossa equipe já foi notificada.</p><div style="background:#f5f5f7; border-radius:8px; padding:16px; margin:16px 0;"><p style="margin:0 0 6px;"><strong>Número:</strong> {{ticket_number}}</p><p style="margin:0 0 6px;"><strong>Assunto:</strong> {{title}}</p><p style="margin:0;"><strong>Categoria:</strong> {{category}}</p></div><p>Você receberá uma nova notificação quando o atendimento for concluído.</p>',
 '',
 '',
 '',
 ''),
('ticket_completed',
 'PESQUISA DE SATISFAÇÃO - T.I',
 'Pesquisa de Satisfação — Chamado #{{ticket_number}}',
 'Olá, <strong>{{first_name}}</strong>, tudo bem?',
 '<p>O seu chamado técnico <strong>#{{ticket_number}}</strong> ({{title}}) foi encerrado pela nossa equipe de TI.</p><p>Para garantirmos a qualidade do nosso atendimento e buscarmos melhorias contínuas, gostaríamos de saber como foi a sua experiência. Leva menos de 1 minutinho.</p><p>Por favor, clique no botão abaixo para responder à nossa rápida pesquisa de satisfação:</p>',
 'Responder Pesquisa de Satisfação',
 '"Pesquisa de Satisfação TI - Grupo Orion" <satisfacaosp@grupoorion.eng.br>',
 'satisfacaosp@grupoorion.eng.br',
 'adm.tisp@grupoorion.com.br');
