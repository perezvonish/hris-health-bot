import dotenv from "dotenv";
import {Scenes, session, Telegraf} from "telegraf";
import type {HealthCheckContext} from "./scenes/health-check/session.ts";
import {healthCheckScene} from "./scenes/health-check/scene.js";


dotenv.config();

const token = process.env.BOT_TOKEN as string;

const bot = new Telegraf<HealthCheckContext>(process.env.BOT_TOKEN!);

/**
 * 1️⃣ session ОБЯЗАТЕЛЬНО раньше stage
 */
bot.use(session());


/**
 * 2️⃣ регистрируем сцены
 */
const stage = new Scenes.Stage<HealthCheckContext>([healthCheckScene]);
bot.use(stage.middleware());

/**
 * 3️⃣ вход в сцену
 */
bot.start(async (ctx) => {
    await ctx.scene.enter("diary-scene");
});

/**
 * просто чтобы проверить что бот жив
 */
bot.command("exit", async (ctx) => {
    await ctx.scene.leave();
    await ctx.reply("Вышли из сценария");
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));