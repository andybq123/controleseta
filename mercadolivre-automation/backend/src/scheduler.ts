import cron from "node-cron";
import { getSettings } from "./db.js";
import { runPipeline } from "./services/pipeline.js";
import { logger } from "./logger.js";

let task: ReturnType<typeof cron.schedule> | null = null;
let currentExpression: string | null = null;

function scheduleWith(expression: string) {
  if (task) {
    task.stop();
    task = null;
  }

  if (!cron.validate(expression)) {
    logger.error(`Expressao cron invalida: "${expression}". Agendamento nao iniciado.`);
    currentExpression = null;
    return;
  }

  task = cron.schedule(expression, () => {
    runPipeline("schedule").catch((error) => {
      logger.error("Erro nao tratado na execucao agendada:", error);
    });
  });
  currentExpression = expression;
  logger.info(`Agendamento ativo com expressao cron "${expression}".`);
}

/** Reavalia as configuracoes atuais e reagenda o cron se necessario. Chamar sempre que as settings mudarem. */
export function refreshSchedule() {
  const settings = getSettings();

  if (!settings.schedule.enabled) {
    if (task) {
      task.stop();
      task = null;
      currentExpression = null;
      logger.info("Agendamento desativado.");
    }
    return;
  }

  if (settings.schedule.cron !== currentExpression) {
    scheduleWith(settings.schedule.cron);
  }
}

export function startScheduler() {
  refreshSchedule();
}
