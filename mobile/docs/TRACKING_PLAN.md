# Plano de tracking

Auditoria concluída em 2026-08-01. Este documento e `src/lib/analytics-events.ts` formam o contrato: toda alteração de evento deve atualizar ambos.

## Regras do contrato

- O PostHog recebe somente sinais capturados pelo app em runtime. Nenhuma métrica depende de App Store Connect, notificações de servidor ou Play Console.
- Todos os eventos recebem `app_platform`, `app_version`, `is_premium` e `saved_scenario_count`. `has_brand_profile` é um booleano opcional; dados da marca continuam apenas no dispositivo.
- Person properties permitidas: `is_premium` e `first_app_version`. Nome, e-mail, telefone, registro e site são proibidos.
- Valores brutos de empréstimo, imóvel, parcela e cliente são proibidos. Use faixas (`principal_bucket`, `rate_bucket`) e booleanos.
- Em desenvolvimento, `EXPO_PUBLIC_ANALYTICS_DRYRUN=1` escreve no console e no sink em memória, sem rede.
- Convenções: nomes em `snake_case`, preferencialmente `objeto_acao`; eventos históricos de alto valor são estendidos, não renomeados.

## Auditoria e delta de call sites

“Atual” descreve o código antes desta revisão. “Alvo” é o contrato vigente.

| Evento                                         | Propriedades atuais auditadas                                     | Propriedades alvo                                                                                                                             | Ação                                        |
| ---------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `$app_opened`                                  | nenhuma                                                           | substituído por `app_open`                                                                                                                    | retirar                                     |
| `$app_installed`                               | base duplicada                                                    | `app_installed` + super properties                                                                                                            | retirar/renomear; sem uso analítico de loja |
| `app_open`                                     | ausente                                                           | somente super properties; cold start e foreground após 30 min                                                                                 | adicionar                                   |
| `calculation_performed`                        | ausente                                                           | `system`, `loan_mode`, `rate_type`, `rate_bucket`, `term_months`, `principal_bucket`, contagens, `index_type`, custos booleanos, `entry_mode` | adicionar; debounce 2 s                     |
| `scenario_saved`                               | update, premium, contagem + cenário com principal bruto           | mesmos campos, cenário sanitizado e `principal_bucket`                                                                                        | estender/remover PII financeiro             |
| `scenario_loaded`                              | cenário com principal bruto                                       | cenário sanitizado                                                                                                                            | manter/corrigir                             |
| `scenario_deleted`                             | `remaining_scenarios`                                             | igual                                                                                                                                         | manter                                      |
| `scenario_new_started`                         | `source`, contagem + cenário com principal bruto                  | igual sem valor bruto                                                                                                                         | manter/corrigir                             |
| `scenario_save_blocked_free_limit`             | `scenario_count`                                                  | igual                                                                                                                                         | manter                                      |
| `scenario_limit_upgrade_clicked`               | `source`                                                          | igual                                                                                                                                         | manter                                      |
| `prepayment_added`                             | tipo, estratégia + cenário                                        | acrescentar `recurrence`, `months_from_start`; cenário sanitizado                                                                             | estender                                    |
| `prepayment_removed`                           | restante + cenário                                                | igual sem valores brutos                                                                                                                      | manter/corrigir                             |
| `fgts_added`                                   | uso, estratégia + cenário                                         | acrescentar `recurrence`, `months_from_start`; cenário sanitizado                                                                             | estender                                    |
| `fgts_removed`                                 | restante + cenário                                                | igual sem valores brutos                                                                                                                      | manter/corrigir                             |
| `export_sheet_opened`                          | premium, rewarded disponível, plataforma                          | igual                                                                                                                                         | manter                                      |
| `export_sheet_abandoned`                       | ausente                                                           | premium, plataforma; nenhum formato escolhido                                                                                                 | adicionar                                   |
| `export_clicked`                               | formato, origem, tipo, premium/rewarded + cenário                 | igual sem valores brutos                                                                                                                      | manter/corrigir                             |
| `export_success`                               | formato, origem, acesso, opções + cenário e nome bruto de cliente | igual, apenas `has_client_name`                                                                                                               | manter/remover PII                          |
| `export_failed`                                | mesmo contexto de exportação e nome bruto                         | mesmo alvo sanitizado                                                                                                                         | manter/remover PII                          |
| `export_blocked_premium`                       | formato, origem, rewarded + cenário                               | igual sem valores brutos                                                                                                                      | manter/corrigir                             |
| `export_upgrade_clicked`                       | `source`, `placement`/`platform`                                  | igual                                                                                                                                         | manter                                      |
| `professional_export_profile_incomplete`       | origem, flags do perfil + cenário                                 | igual; somente flags                                                                                                                          | manter                                      |
| `professional_export_profile_ready`            | origem, flags do perfil + cenário                                 | igual; somente flags                                                                                                                          | manter                                      |
| `professional_export_client_modal_opened`      | origem, flags + cenário                                           | igual                                                                                                                                         | manter                                      |
| `professional_export_client_modal_cancelled`   | incluía nome bruto do cliente                                     | `has_client_name` + flags + cenário sanitizado                                                                                                | remover PII                                 |
| `professional_export_started`                  | incluía nome bruto do cliente                                     | formato/origem + `has_client_name` + flags                                                                                                    | remover PII/estender                        |
| `professional_profile_logo_selected`           | flags + MIME                                                      | igual                                                                                                                                         | manter                                      |
| `professional_profile_logo_removed`            | flags + tinha logo                                                | igual                                                                                                                                         | manter                                      |
| `professional_profile_save_blocked_incomplete` | flags                                                             | igual                                                                                                                                         | manter                                      |
| `professional_profile_saved`                   | flags e `identify` com nome/e-mail/telefone/registro/site         | flags; super property `has_brand_profile`; sem identify PII                                                                                   | retirar identity PII                        |
| `professional_profile_save_failed`             | flags                                                             | igual                                                                                                                                         | manter                                      |
| `professional_profile_cleared`                 | flags e reset de identidade                                       | flags + `has_brand_profile=false`; não havia motivo válido para identificar                                                                   | corrigir                                    |
| `professional_profile_clear_failed`            | nenhuma                                                           | nenhuma                                                                                                                                       | manter                                      |
| `premium_entry_clicked`                        | origem e posição                                                  | igual                                                                                                                                         | manter                                      |
| `premium_paywall_viewed`                       | estado da loja sem origem                                         | `source` obrigatório, `nth_view` + estado da loja; `price_label` somente após a loja fornecer preço localizado                                | estender                                    |
| `premium_status_viewed`                        | estado da loja                                                    | igual; `price_label` opcional enquanto o produto não foi carregado                                                                            | manter                                      |
| `premium_status_sync_requested`                | estado da loja                                                    | igual                                                                                                                                         | manter                                      |
| `paywall_dismissed`                            | ausente                                                           | `source`, tempo, `nth_view`, dias desde instalação                                                                                            | adicionar                                   |
| `paywall_purchase_cta_clicked`                 | ausente                                                           | `source`, `nth_view` antes da folha nativa                                                                                                    | adicionar                                   |
| `purchase_started`                             | disparava antes das precondições; contexto sem tentativa          | contexto + `attempt_id`, `nth_view`, somente após conexão/produto; `price_label` localizado quando conhecido                                  | corrigir                                    |
| `purchase_success`                             | contexto sem tentativa                                            | contexto + `attempt_id`; terminal único; `price_label` opcional                                                                               | corrigir                                    |
| `purchase_cancelled`                           | misturado em failed                                               | contexto + `attempt_id`; código SDK `user-cancelled`; `price_label` opcional                                                                  | adicionar                                   |
| `purchase_failed`                              | sem código nem dedupe                                             | contexto + `attempt_id`, `error_code`; terminal único; sem `price_label` na reconciliação tardia, pois o preço histórico é desconhecido       | corrigir                                    |
| `purchase_store_unavailable`                   | contexto                                                          | igual; não cria tentativa                                                                                                                     | manter                                      |
| `purchase_restore_started`                     | contexto                                                          | igual                                                                                                                                         | manter                                      |
| `purchase_restore_success`                     | contexto                                                          | igual                                                                                                                                         | manter                                      |
| `purchase_restore_empty`                       | contexto                                                          | igual                                                                                                                                         | manter                                      |
| `purchase_restore_failed`                      | contexto                                                          | acrescenta código quando disponível                                                                                                           | estender                                    |
| `premium_status_lost`                          | ausente; erros revogavam Premium                                  | `days_since_purchase`, somente `confirmed_absent`                                                                                             | adicionar/corrigir entitlement              |
| `rewarded_export_requested`                    | formato, origem, tipo                                             | igual                                                                                                                                         | manter                                      |
| `rewarded_ad_chosen_over_premium`              | ausente                                                           | `source`, `nth_time` persistido                                                                                                               | adicionar                                   |
| `rewarded_export_ad_opened`                    | formato, origem, stub                                             | igual                                                                                                                                         | manter                                      |
| `rewarded_export_ad_reward_earned`             | formato, origem, stub                                             | igual                                                                                                                                         | manter                                      |
| `rewarded_export_ad_cancelled`                 | formato, origem, stub                                             | igual                                                                                                                                         | manter                                      |
| `rewarded_export_ad_failed`                    | `error_message` livre                                             | manter `error_message` para continuidade e acrescentar `error_kind` normalizado (`no_fill`, `load_timeout`, `network`, `unknown`)             | estender                                    |
| `rewarded_export_unlocked`                     | formato, origem, stub                                             | igual                                                                                                                                         | manter                                      |
| `interstitial_shown`                           | origem, stub                                                      | igual                                                                                                                                         | manter                                      |
| `app_open_ad_shown`                            | stub opcional                                                     | igual                                                                                                                                         | manter                                      |
| `comparison_configuration_updated`             | principal/rate brutos, prazo, sistema, modo, premium, casos       | `rate_bucket`, prazo, sistema, modo, premium, contagem                                                                                        | remover valor bruto                         |
| `feedback_email_clicked/opened/copied`         | nenhuma                                                           | nenhuma                                                                                                                                       | manter                                      |
| `feedback_email_failed`                        | razão                                                             | igual                                                                                                                                         | manter                                      |
| `feedback_whatsapp_clicked/opened`             | nenhuma                                                           | nenhuma                                                                                                                                       | manter                                      |
| `feedback_whatsapp_failed`                     | razão                                                             | igual                                                                                                                                         | manter                                      |

## Eventos reservados para itens posteriores

Estes eventos já fazem parte do tipo, mas o call site só nasce no item indicado para não antecipar produto:

| Evento                       | Quando dispara                      | Propriedades                      | Decisão                                                 |
| ---------------------------- | ----------------------------------- | --------------------------------- | ------------------------------------------------------- |
| `validation_warning_shown`   | aviso visível (P0.6/P0.7)           | `warning_code`                    | quais entradas confundem                                |
| `table_expanded`             | primeira expansão da sessão         | nenhuma além das super properties | uso da tabela completa                                  |
| `comparison_started`         | primeira interação da sessão (P3.2) | nenhuma                           | adoção real do comparador                               |
| `review_prompt_requested`    | pedido ao SO (P1.5)                 | `trigger`                         | política do pedido; não mede exibição/rating            |
| `notification_optin_changed` | mudança de preferência futura       | enabled, source                   | interesse em reengajamento; push permanece fora de P2.5 |
| `portability_compared`       | cálculo de portabilidade (P2.3)     | tem break-even e mês              | demanda/resultado da comparação                         |
| `optimizer_opened`           | abertura do assistente (P2.7)       | entry point                       | descoberta                                              |
| `optimizer_plan_generated`   | plano válido (P2.7)                 | meta e buckets                    | demanda por meta                                        |
| `optimizer_plan_saved`       | plano salvo (P2.7)                  | meta                              | valor realizado                                         |

`chart_viewed` dispara uma vez por sessão para `balance`, `payment` e `composition`. `bacen_rate_fetch_failed` dispara para TR/IPCA com `error_kind` sem mensagem livre.

## Lifecycle e compra

- O SDK está com `captureAppLifecycleEvents: false`.
- `app_open` é emitido uma vez no cold start e novamente ao voltar ao foreground somente quando o app permaneceu em background por pelo menos 30 minutos; permanecer ativo por 30 minutos não cria outro open.
- A tentativa de compra fica em AsyncStorage com `attempt_id`, origem, `nth_view` e horário. Somente `purchase_success`, `purchase_cancelled` ou `purchase_failed` remove a tentativa. Callback tardio perde a disputa e não duplica terminal.
- Tentativa pendente por mais de 30 minutos é reconciliada no launch como `purchase_failed/error_code=stale_unresolved`.
- Se uma nova compra começar enquanto outra tentativa ainda está pendente, a anterior recebe o terminal `purchase_failed/error_code=superseded` antes da nova tentativa ser persistida.
- O código de cancelamento confirmado no `expo-iap@3.4.13` instalado é `user-cancelled` (`ErrorCode.UserCancelled`).
- Entitlement: `entitled`, `confirmed_absent`, `indeterminate`. Apenas resposta bem-sucedida sem a compra revoga. Falha de conexão/rede preserva o último estado conhecido.
- `price_label` representa exclusivamente o preço localizado devolvido pelo produto da loja ou, quando a loja está inalcançável durante o evento, o fallback configurado. A propriedade fica ausente enquanto uma loja conectada ainda não retornou o produto e na reconciliação de tentativa antiga, cujo preço histórico não é conhecido.
- `first_app_version` é gravado uma vez em AsyncStorage; sincronizações futuras reutilizam o valor original. Para instalações anteriores a esta versão, o primeiro valor observável é a versão desta migração.
- Para usuários que já eram Premium antes desta migração, `days_since_purchase` mede dias desde a primeira observação local do Premium, pois a data histórica da compra não existia no armazenamento do app.
- O timestamp de instalação vem de `expo-application`, inclusive para a base existente, evitando zerar artificialmente `days_since_install`.
- Dry-run tem precedência sobre a configuração de produção: com `EXPO_PUBLIC_ANALYTICS_DRYRUN=1`, nenhum cliente PostHog é criado mesmo se houver API key.

## Apêndice de eventos legados

| Nome legado                     | Interpretação                                                | Destino canônico |
| ------------------------------- | ------------------------------------------------------------ | ---------------- |
| `app_open` anterior a 1.2.0     | implementação histórica, sem contrato de intervalo garantido | `app_open` atual |
| `$app_opened`                   | chamada manual removida                                      | `app_open`       |
| `Application Opened`            | lifecycle automático do SDK removido                         | `app_open`       |
| `calculator_inline` em `source` | nome histórico da oferta inline na calculadora               | `export_upgrade` |

Callbacks de sucesso extremamente tardios podem chegar depois de uma tentativa já reconciliada como `stale_unresolved`; nesse caso o entitlement é ativado, mas o terminal não é duplicado.

## Dashboards PostHog

Criados via API no projeto `calculadorapricesac` (id 389897) em 2026-08-01:

1. **Activation** — https://us.posthog.com/project/389897/dashboard/1939113
   - Funnel de usuários únicos, janela 7 dias: `app_open` → `calculation_performed` → qualquer um de `scenario_saved` ou `export_clicked`.
   - Retention: evento inicial e retorno `app_open`, intervalo diário, D7, usuários únicos, versão pós-release.
2. **Monetization / purchase decision** — https://us.posthog.com/project/389897/dashboard/1939114
   - Funnel de usuários únicos: `premium_paywall_viewed` → `paywall_purchase_cta_clicked` → `purchase_started` → `purchase_success`; breakdown `source` do primeiro passo.
   - Trends: `paywall_dismissed / premium_paywall_viewed`; distribuição de `nth_view`; `purchase_cancelled` versus `purchase_failed` por `error_code`; `rewarded_ad_chosen_over_premium`; `premium_status_lost`.
   - Funnel rewarded: `rewarded_export_requested` → `rewarded_export_ad_opened` → `rewarded_export_ad_reward_earned` → `rewarded_export_unlocked`, breakdown por `source` e `error_kind` nas falhas.
3. **Feature adoption** — https://us.posthog.com/project/389897/dashboard/1939115
   - Trends de usuários únicos: `calculation_performed` com breakdowns separados por `system`, `index_type`, `entry_mode`.
   - `prepayment_added` e `fgts_added` por `recurrence`; `comparison_started`; `professional_export_started`; `optimizer_plan_generated` quando disponíveis.

Não criar funil review→rating: o SO não informa exibição nem avaliação. Não criar métricas dependentes de installs/reembolsos das lojas; os proxies aceitos são `app_installed`, `app_open` e a reconciliação de entitlement no app.

## Ações do proprietário

- `[b] BLOCKED — owner action: no PostHog, abrir Persons no projeto 389897, localizar propriedades históricas name, email, phone, registration e website originadas do perfil profissional e executar delete/redact; confirmar que não restaram valores dessas chaves.`
