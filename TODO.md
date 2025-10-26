#TODO

## movie video and movie provider

| Tình huống                                            | Có nên tách `movie_provider` và `movie_video`? | Giải thích                     |
| ----------------------------------------------------- | ---------------------------------------------- | ------------------------------ |
| Dùng 1 CDN, mỗi phim 1 file duy nhất                  | ❌ Không cần                                    | Dễ, gọn                        |
| Dùng nhiều CDN (Bunny, R2, Wasabi)                    | ✅ Có                                           | Mỗi provider là 1 nguồn phát   |
| Một provider chứa nhiều bản chất lượng (720p–4K)      | ✅ Có                                           | Cần map provider → nhiều video |
| Bạn muốn quản lý CDN, health-check, ưu tiên, fallback | ✅ Có                                           | Phải có bảng riêng để theo dõi |
| Bạn chỉ cần demo local nhỏ                            | ❌ Không cần                                    | Gộp để đơn giản                |
