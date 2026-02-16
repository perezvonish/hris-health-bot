// @ts-nocheck

import {Scenes, Markup} from "telegraf";
import type {HealthCheckContext} from "./session.js";

const yesNo = Markup.keyboard([["да", "нет"]]).oneTime().resize();

const fastingKb = Markup.keyboard([
    ["нет"],
    ["да, меньше часа"],
    ["2–3 часа"],
    ["больше 3 часов"],
]).oneTime().resize();

const activityKb = Markup.keyboard([
    ["Не было"],
    ["Мало (дорога/быт)"],
    ["Средне (5к+ шагов/спорт)"],
    ["Сверх нормы"],
]).oneTime().resize();

function multiKeyboard(options: string[], selected: string[]) {
    return Markup.inlineKeyboard([
        ...options.map((o) => {
            const checked = selected.includes(o);
            return [Markup.button.callback(`${checked ? "❌" : "✅"} ${o}`, `m:${o}`)];
        }),
        [Markup.button.callback("Готово", "m:done")],
    ]);
}

function scaleKeyboard(prefix: string, isPositive: boolean) {
    const base = ["😣", "😕", "😐", "🙂", "😊", "😌", "💪", "🔥", "🚀", "🤯", "🌟"];
    const emojis = isPositive ? base : [...base].reverse();

    return Markup.inlineKeyboard(
        Array.from({length: 11}).map((_, i) =>
            Markup.button.callback(`${i} ${emojis[i]}`, `${prefix}:${i}`)
        ),
        {columns: 6}
    );
}

function toggleValue(arr: string[], value: string) {
    const i = arr.indexOf(value);
    i >= 0 ? arr.splice(i, 1) : arr.push(value);
}

async function handleMultiStep(
    ctx: HealthCheckContext,
    field: "mealsSkipped" | "medsIssues",
    options: string[],
    nextStep: number,
    nextQuestion: () => Promise<unknown>
) {
    const data = ctx.callbackQuery!.data!;
    const arr = ctx.session.answers[field];

    if (data === "m:done") {
        ctx.session.step = nextStep;
        await ctx.editMessageReplyMarkup(undefined);
        return nextQuestion();
    }

    toggleValue(arr, data.slice(2));

    return ctx.editMessageReplyMarkup(
        multiKeyboard(options, arr).reply_markup
    );
}

async function handleScaleStep(
    ctx: HealthCheckContext,
    field: "mood" | "migraine" | "libido",
    nextStep: number,
    nextQuestion: () => Promise<unknown>
) {
    const value = Number(ctx.callbackQuery!.data!.split(":")[1]);
    (ctx.session.answers as any)[field] = value;
    ctx.session.step = nextStep;

    return nextQuestion();
}

export const healthCheckScene = new Scenes.BaseScene<HealthCheckContext>("diary-scene");

healthCheckScene.enter(async (ctx) => {
    ctx.session.step = 0;

    ctx.session.answers = {
        mealsSkipped: [],
        medsIssues: [],
    };

    await ctx.reply(
        "Во сколько вчера легла?",
        Markup.keyboard([
            ["раньше 22", "22", "23"],
            ["00", "01", "02"],
            ["позже 2"],
        ]).resize()
    );
});

healthCheckScene.on("text", async (ctx, next) => {
    const step = ctx.session.step;

    if (step === 0) {
        ctx.session.answers.sleepTime = ctx.message.text;
        ctx.session.step = 1;

        return ctx.reply(
            "Во сколько сегодня проснулась?",
            Markup.keyboard([
                ["раньше 08", "08", "09"],
                ["10", "11", "позже 11"],
            ]).resize()
        );
    }

    if (step === 1) {
        ctx.session.answers.wakeTime = ctx.message.text;
        ctx.session.step = 2;

        return ctx.reply("Работала сегодня?", yesNo);
    }

    if (step === 2) {
        ctx.session.answers.workedToday = ctx.message.text;
        ctx.session.step = 3;

        return ctx.reply("Была менструация?", yesNo);
    }

    if (step === 3) {
        ctx.session.answers.menstruation = ctx.message.text;
        ctx.session.step = 4;

        return ctx.reply("Было ли голодание в течение дня?", fastingKb);
    }

    if (step === 4) {
        ctx.session.answers.fasting = ctx.message.text;
        ctx.session.step = 5;

        return ctx.reply("Была ли физическая активность?", activityKb);
    }

    if (step === 5) {
        ctx.session.answers.activity = ctx.message.text;
        ctx.session.step = 6;

        return ctx.reply(
            "Что пропускала?",
            multiKeyboard(
                ["Завтрак", "Обед", "Ужин"],
                ctx.session.answers.mealsSkipped
            )
        );
    }

    if (step === 10) {
        const raw = ctx.message.text.trim().replace(",", ".");
        const dose = Number(raw);

        if (!Number.isFinite(dose) || dose <= 0) {
            return ctx.reply("Нужно ввести число в миллиграммах. Например: 200");
        }

        ctx.session.answers.migraineDose = dose;
        ctx.session.step = 11;

        return ctx.reply("Либидо:", scaleKeyboard("libido", true));
    }

    return next();
});


healthCheckScene.on("callback_query", async (ctx) => {
    if (!("data" in ctx.callbackQuery)) return;

    const step = ctx.session.step;
    const data = ctx.callbackQuery.data;

    await ctx.answerCbQuery();

    if (step === 6) {
        return handleMultiStep(
            ctx,
            "mealsSkipped",
            ["Завтрак", "Обед", "Ужин"],
            7,
            () =>
                ctx.reply(
                    "Какие таблетки пропустила?",
                    multiKeyboard(
                        ["Венлаксор | Утро", "Венлаксор | Вечер", "Триттико"],
                        ctx.session.answers.medsIssues
                    )
                )
        );
    }

    if (step === 7) {
        return handleMultiStep(
            ctx,
            "medsIssues",
            ["Венлаксор | Утро", "Венлаксор | Вечер", "Триттико"],
            8,
            () => ctx.reply("Оцени настроение:", scaleKeyboard("mood", true))
        );
    }

    if (step === 8)
        return handleScaleStep(ctx, "mood", 9, () =>
            ctx.reply("Оцени мигрень:", scaleKeyboard("migraine", false))
        );

    if (step === 9) {
        const migraine = Number(data.split(":")[1]);
        ctx.session.answers.migraine = migraine;

        if (migraine <= 2) {
            ctx.session.step = 11;
            return ctx.reply("Либидо:", scaleKeyboard("libido", true));
        }

        ctx.session.step = 10;

        return ctx.reply(
            "Введите дозировку в мг (например 400):",
            Markup.removeKeyboard()
        );
    }

    if (step === 11)
        return handleScaleStep(ctx, "libido", 12, async () => {
            console.log("FINAL:", ctx.session.answers);
            await ctx.reply("Готово ✅");
            return ctx.scene.leave();
        });
});

// FINAL: {
//     mealsSkipped: [ 'Обед' ],
//         medsIssues: [ 'Венлаксор | Вечер' ],
//         sleepTime: 'раньше 22',
//         wakeTime: 'раньше 08',
//         workedToday: 'да',
//         menstruation: 'да',
//         fasting: 'нет',
//         activity: 'перегрузка',
//         mood: 5,
//         migraine: 0,
//         libido: 10
// }
