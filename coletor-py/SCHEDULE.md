# Agendamento automático

Roda o coletor 3x ao dia (07:00, 13:00, 19:00) sem precisar abrir nada.

## Windows — Agendador de Tarefas

1. Abra **Agendador de Tarefas** (tecla Windows e digite "Agendador").
2. **Ação → Criar Tarefa…**
3. **Geral**: nome `Coletor 1Doc`, marque "Executar estando o usuário conectado ou não" e "Executar com privilégios mais altos".
4. **Disparadores → Novo…**: Diariamente, 07:00. Repita criando outros 2 disparadores em 13:00 e 19:00.
5. **Ações → Novo…**:
   - Ação: *Iniciar um programa*
   - Programa/script: `C:\caminho\completo\para\coletor-py\run.bat`
   - Iniciar em: `C:\caminho\completo\para\coletor-py`
6. **Condições**: desmarque "Iniciar a tarefa somente se o computador estiver na energia da rede elétrica" se for notebook usado na bateria.
7. OK → digite sua senha do Windows.

Pra testar: clique com o direito na tarefa → **Executar**.

## macOS — launchd

Crie `~/Library/LaunchAgents/com.controleseta.coletor.plist` (ajuste o caminho):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.controleseta.coletor</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/SEU_USUARIO/projetos/coletor-py/run.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>13</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>19</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>/tmp/coletor.log</string>
  <key>StandardErrorPath</key><string>/tmp/coletor.err</string>
</dict>
</plist>
```

Carregar:

```bash
launchctl load ~/Library/LaunchAgents/com.controleseta.coletor.plist
```

## Linux — cron

```bash
crontab -e
```

Adicione (ajuste o caminho):

```
0 7,13,19 * * * cd /home/SEU_USUARIO/coletor-py && ./run.sh >> /tmp/coletor.log 2>&1
```

## Importante

- Em qualquer dos casos, o computador precisa estar **ligado e online** no
  horário agendado. Se ficar desligado, a próxima execução só roda no
  próximo horário.
- Os logs ajudam a depurar quando algo falha: confira `/tmp/coletor.log`
  (macOS/Linux) ou o histórico do Agendador de Tarefas (Windows).