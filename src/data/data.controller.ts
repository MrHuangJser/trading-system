import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { DataService } from './data.service';

const TEMP_UPLOAD_DIR = resolve(process.cwd(), 'storage', 'uploads');

function ensureUploadDir() {
  if (!existsSync(TEMP_UPLOAD_DIR)) {
    mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
  }
}

ensureUploadDir();

@Controller('api/data')
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          _req: Request,
          _file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          ensureUploadDir();
          cb(null, TEMP_UPLOAD_DIR);
        },
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const extension = extname(file.originalname) || '.csv';
          cb(null, `${unique}${extension}`);
        },
      }),
    }),
  )
  async uploadDataset(
    @UploadedFile() file: Express.Multer.File,
    @Body('note') note?: string,
    @Body('activate') activate?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    ensureUploadDir();
    const bunFile = Bun.file(resolve(TEMP_UPLOAD_DIR, file.filename));
    try {
      const dataset = await this.dataService.saveUpload(bunFile, {
        originalName: file.originalname,
        note: note ?? null,
        activate: this.parseBoolean(activate),
      });
      return dataset;
    } finally {
      if (await bunFile.exists()) {
        await bunFile.delete().catch(() => undefined);
      }
    }
  }

  @Get()
  listDatasets() {
    return this.dataService.listDatasets();
  }

  @Patch(':id/activate')
  activateDataset(@Param('id') id: string) {
    return this.dataService.setActiveDataset(id);
  }

  @Delete(':id')
  async removeDataset(@Param('id') id: string) {
    await this.dataService.removeDataset(id);
    return { success: true };
  }

  private parseBoolean(value?: string): boolean {
    if (!value) {
      return false;
    }
    const normalized = value.toLowerCase();
    return (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'yes' ||
      normalized === 'on'
    );
  }
}
