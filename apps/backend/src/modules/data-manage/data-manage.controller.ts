import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import fs from 'fs-extra';
import path from 'path';
import {
  AggregationService,
  Timeframe,
} from '../shared/services/aggregation.service';

@Controller('data-manage')
export class DataManageController {
  constructor(private readonly aggregationService: AggregationService) {
    fs.ensureDirSync(path.join(process.cwd(), 'storage', 'dataset'));
  }

  @Post('upload-dataset')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDataset(@UploadedFile() file: Express.Multer.File) {
    const filePath = path.join(
      process.cwd(),
      'storage',
      'dataset',
      file.originalname
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

  @Get('aggregate-dataset')
  async aggregateDataset(
    @Query('filename') filename: string,
    @Query('timeframe') timeframe: Timeframe
  ) {
    const filePath = path.join(process.cwd(), 'storage', 'dataset', filename);
    const result = await this.aggregationService.aggregate(filePath, timeframe);

    return {
      message: 'Dataset aggregated',
      result,
    };
  }
}
