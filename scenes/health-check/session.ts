import {Scenes} from "telegraf";

/**
 * Это твои пользовательские данные
 */
export interface HealthCheckData {
    answers: {
        sleepTime?: string;
        wakeTime?: string;
        workedToday?: string;
        menstruation?: string;
    };
}

/**
 * А это итоговая session:
 * wizard + твои поля
 */
export interface HealthCheckSession
    extends Scenes.WizardSessionData,
        HealthCheckData {
}

/**
 * Контекст, который знает про:
 * - session
 * - scene
 * - wizard
 */
export type HealthCheckContext = Scenes.WizardContext<HealthCheckSession>;
