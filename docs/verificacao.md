# Verificação, evidências e limites

**Versão alvo: MADO 1.3.0-rc1.** Consulte os relatórios gerados em `evidence/` para os resultados efetivos. Este documento explica como interpretá-los; não replica números de versões anteriores como resultados atuais.

## Perguntas diferentes exigem evidências diferentes

| Camada | Pergunta | Evidência esperada |
| --- | --- | --- |
| Processamento | Os arquivos RDF/OWL podem ser lidos? | Resultado do parser e arquivos de entrada. |
| Perfil OWL 2 DL | A formalização respeita o perfil declarado? | Relatório da ferramenta de perfil. |
| Consistência | Há contradições ou classes insatisfatíveis indevidas? | Reasoner, versão, resultado e lista de classes. |
| Integridade | Os dados têm os vínculos e valores exigidos? | Relatório SHACL, incluindo testes de ausência de campos. |
| Questões de competência | As consultas respondem às perguntas previstas? | Entrada, consulta, resultado esperado e obtido. |
| Composição | A orientação respeita condições e fundamentação? | Casos positivos, negativos, incompletos e adversos. |
| Articulação | Relacionar conhecimentos acrescentou algo observável? | Comparação controlada com e sem expansão. |
| Navegador | A variante pública conserva a semântica da execução? | Comparação nativa/navegador e registro de diferenças. |
| Acessibilidade da interface | As pessoas conseguem acessar e operar os fluxos testados? | Inspeção automatizada e testes humanos delimitados. |
| Adequação percebida | A saída faz sentido para o contexto examinado? | Julgamento humano documentado na versão avaliada. |

Uma execução sem erro não implica aprovação de todas essas camadas. Da mesma forma, satisfação com a orientação não prova correção OWL, aprendizagem ou generalização.

## Oito perguntas orientadoras

1. O contexto está representado e suas informações ausentes são reconhecidas?
2. Quais conhecimentos são pertinentes e por quais correspondências?
3. Quais fontes, trechos, perspectivas e articulações os sustentam?
4. Quais critérios são fundamentados naquele emprego?
5. Quais decisões, resultados e limites anteriores são pertinentes?
6. Qual decisão pode ser composta para o contexto?
7. Qual é a cadeia completa e exata de rastreabilidade?
8. Quando o conhecimento ou a informação é insuficiente?

As consultas versionadas em `queries/` são a especificação executável. A aprovação deve considerar conteúdo esperado, não apenas a existência de linhas no resultado.

## Testes que fazem diferença

- **Apoio exato:** CA02 não pode receber um conhecimento apenas porque ambos aparecem na mesma configuração.
- **Ausência:** remover uma configuração ou origem obrigatória precisa ser detectado.
- **Incompatibilidade:** uma relação de complementação não pode anular uma restrição de aplicação.
- **Recursos:** confirmar, não informar e impedir um recurso precisam produzir estados coerentes.
- **Novo arranjo:** testar uma combinação não cadastrada como cenário completo, sem acrescentar conteúdo para aprová-la.
- **Interpretação separada:** testar o contexto estruturado independentemente da capacidade de interpretar sua narrativa.
- **Articulação:** comparar conhecimentos e funções efetivamente empregados, não somente o volume recuperado.
- **Privacidade:** não conservar narrativas, orientações ou avaliações após limpar ou encerrar o caso.

## O que não pode ser concluído

Este demonstrador não prova que as orientações melhoram resultados educacionais, que funcionam para qualquer pessoa, que qualquer narrativa é compreendida, ou que a interface satisfaz integralmente um padrão de acessibilidade.

A revisão especializada anterior pertence à sua versão e ao procedimento registrado. Não é uma avaliação automática das modificações deste repositório. Não houve uma nova avaliação humana apenas porque o código foi atualizado.

## Como conferir sem usar a interface

Leia as classes e propriedades no Turtle e abra a distribuição RDF/XML no Protégé. Confira o identificador de versão antes de executar um reasoner. A seleção do reasoner e o estado de execução devem ser acompanhados do relatório técnico; uma captura de tela é evidência complementar.

Examine SHACL e consultas separadamente: um reasoner opera sob semântica OWL e não deve ser usado como substituto da detecção operacional de informações ausentes.

Guarde versão, hash, ferramenta, entrada e resultado ao reproduzir uma execução. Sem esses elementos, resultados de versões diferentes podem ser confundidos.
