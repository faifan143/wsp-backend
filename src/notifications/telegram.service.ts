import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private bot: TelegramBot | null = null;
  private readonly logger = new Logger(TelegramService.name);

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token) {
      this.bot = new TelegramBot(token, { polling: false });
      this.logger.log('Telegram bot initialized');
    } else {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured, Telegram notifications disabled');
    }
  }

  async sendMessage(chatId: string, message: string): Promise<boolean> {
    if (!this.bot) {
      this.logger.warn('Telegram bot not initialized');
      return false;
    }

    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send Telegram message: ${error.message}`);
      return false;
    }
  }

  async sendNotification(chatId: string, title: string, message: string): Promise<boolean> {
    const formattedMessage = `<b>${title}</b>\n\n${message}`;
    return this.sendMessage(chatId, formattedMessage);
  }
}
