import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from './person.entity';
import { CreatePersonDto, UpdatePersonDto } from './person.dto';

@Injectable()
export class PersonService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) { }

  /**
   * 📄 Lấy toàn bộ danh sách person
   */
  async getAll(): Promise<Person[]> {
    return await this.personRepository.find({
      order: { created_at: 'DESC' }, // sắp xếp mới nhất
    });
  }

  /**
   * 🔍 Lấy một person theo ID
   */
  async getById(id: string): Promise<Person> {
    const person = await this.personRepository.findOne({ where: { id } });
    if (!person) {
      throw new NotFoundException(`Person with id "${id}" not found`);
    }
    return person;
  }

  /**
   * ➕ Tạo mới một person
   */
  async create(dto: CreatePersonDto): Promise<Person> {
    try {
      const newPerson = this.personRepository.create(dto);
      const saved = await this.personRepository.save(newPerson);

      return saved[0];
    } catch (error) {
      console.error('Error creating person:', error);
      throw new BadRequestException('Failed to create person');
    }
  }


  /**
   * ✏️ Cập nhật thông tin person
   */
  async update(id: string, dto: UpdatePersonDto): Promise<Person> {
    const person = await this.getById(id); // kiểm tra tồn tại

    Object.assign(person, dto); // gộp dữ liệu mới vào object cũ
    return await this.personRepository.save(person);
  }

  /**
   * 🗑️ Xóa một person theo ID
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const person = await this.getById(id); // kiểm tra tồn tại
    await this.personRepository.remove(person);

    return {
      success: true,
      message: `Person with id "${id}" deleted successfully`,
    };
  }
}
