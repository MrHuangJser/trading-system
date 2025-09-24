import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import fs from 'fs';
import path from 'path';

@Controller('data-manage')
export class DataManageController {
  @Post('upload-dataset')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDataset(@UploadedFile() file: Express.Multer.File) {
    const filePath = path.join(
      process.cwd(),
      'storage',
      'dataset',
      file.filename
    );
    fs.writeFileSync(filePath, file.buffer);
    return {
      message: 'File uploaded successfully',
      filename: file.filename,
    };
  }

  @Get('dataset-list')
  async getDatasetList() {
    const filePath = path.join(process.cwd(), 'storage', 'dataset');
    const files = fs.readdirSync(filePath);
    return {
      message: 'Dataset list',
      files,
    };
  }
}
