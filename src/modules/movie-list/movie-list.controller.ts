import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  HttpCode,
  ConflictException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MovieListService } from './movie-list.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '@/modules/auth/guards';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { AddMovieDto } from './dto/add-movie.dto';
import { CreateAndAddDto } from './dto/create-and-add.dto';
import { QueryListDto } from './dto/query-list.dto';
import { Request } from 'express';
import { ResponseUtil } from '@/common';

@Controller('movie-lists')
export class MovieListController {
  constructor(private readonly svc: MovieListService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: Request, @Body() body: CreateListDto) {
    if (!req.user) throw new ConflictException();
    const userId = req.user['sub'];
    const list = await this.svc.create(userId, body);
    return { id: list.id, name: list.name, visibility: list.visibility };
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-and-add')
  createAndAdd(@Req() req: Request, @Body() body: CreateAndAddDto) {
    if (!req.user) throw new ConflictException();
    const userId = req.user['sub'];
    return this.svc.createAndAdd(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMine(@Req() req: Request) {
    if (!req.user) throw new ConflictException();
    const userId = req.user['sub'];
    return this.svc.findMine(userId);
  }

  // ============================================================
  // STATIC ROUTES - MUST BE DECLARED BEFORE DYNAMIC ROUTES
  // ============================================================

  // Public lists
  @Get('public')
  async publicLists(@Query() q: QueryListDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    console.log(page, limit);
    const result = await this.svc.publicLists(page, limit);
    return ResponseUtil.success(result);
  }

  // Recommended lists (authenticated only)
  @UseGuards(JwtAuthGuard)
  @Get('recommended')
  recommendedLists(@Req() req: Request, @Query() q: QueryListDto) {
    if (!req.user) throw new ConflictException();
    const userId = req.user['sub'];
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    return this.svc.recommendedLists(userId, page, limit);
  }

  // Public lists by user
  @Get('user/:userId')
  publicByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() q: QueryListDto,
  ) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    return this.svc.publicListsByUser(userId, page, limit);
  }

  // ============================================================
  // DYNAMIC ROUTES - MUST BE DECLARED AFTER STATIC ROUTES
  // ============================================================

  // Get single list by ID (with UUID validation)
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  getOne(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const user = req.user
      ? { id: req.user['sub'], role: req.user['role'] }
      : undefined;
    return this.svc.findById(id, user);
  }

  // Update list
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateListDto,
  ) {
    if (!req.user) throw new ConflictException();
    const userId = req.user['sub'];
    return this.svc.update(id, userId, body);
  }

  // Delete list
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    if (!req.user) throw new ConflictException();
    const userId = req.user['sub'];
    return this.svc.softRemove(id, userId);
  }

  // Add movie to list
  @UseGuards(JwtAuthGuard)
  @Post(':id/movies')
  addMovie(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddMovieDto,
  ) {
    if (!req.user) throw new ConflictException();
    const userId = req.user['sub'];
    return this.svc
      .addMovie(id, userId, body.movieId, body.position)
      .then(() => ({ success: true, added: true }));
  }

  // Remove movie from list
  @UseGuards(JwtAuthGuard)
  @Delete(':id/movies/:movieId')
  removeMovie(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('movieId', ParseUUIDPipe) movieId: string,
  ) {
    if (!req.user) throw new ConflictException();
    const userId = req.user['sub'];
    return this.svc.removeMovie(id, userId, movieId);
  }
}
