import puppeteer from 'puppeteer';

/**
 * Tìm kiếm và trả về đường dẫn hình ảnh đầu tiên từ Google Images theo từ khóa.
 *
 * @param {string} keyword - Từ khóa tìm kiếm.
 * @returns {Promise<string|null>} - Đường dẫn hình ảnh đầu tiên nếu tìm thấy, ngược lại trả về null.
 */
async function fetchFirstImageUrl(keyword: string): Promise<string | null> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Tạo URL tìm kiếm trên Google Images với từ khóa đã mã hóa
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(keyword)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

  // Chọn phần tử img đầu tiên có class "YQ4gaf" và có thuộc tính alt không rỗng
  const firstImageElement = await page.$('img.YQ4gaf[alt]:not([alt=""])');
  if (!firstImageElement) {
    await browser.close();
    return null;
  }

  // Click vào hình ảnh để mở dialog
  await firstImageElement.click();

  // Đợi dialog hình ảnh được load với selector "img.sFlh5c"
  await page
    .waitForSelector('img.sFlh5c.FyHeAf.iPVvYb', { timeout: 5000 })
    .catch(() => null);

  // Lấy đường dẫn của hình ảnh dialog
  const dialogImageElement = await page.$('img.sFlh5c.FyHeAf.iPVvYb');
  const firstImage = dialogImageElement
    ? await dialogImageElement.evaluate((img) => img.src)
    : null;

  // Đóng trình duyệt và trả về kết quả
  await browser.close();
  return firstImage;
}

const fetchSecondImageUrl = async (keyword: string): Promise<string | null> => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Tạo URL tìm kiếm trên Google Images với từ khóa đã mã hóa
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(keyword)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

  // Chọn phần tử img thứ hai có class "YQ4gaf" và có thuộc tính alt không rỗng
  const secondImageElement = await page.$(
    'img.YQ4gaf[alt]:not([alt=""]) + img.YQ4gaf[alt]:not([alt=""])',
  );
  if (!secondImageElement) {
    await browser.close();
    return null;
  }

  // Click vào hình ảnh để mở dialog
  await secondImageElement.click();

  // Đợi dialog hình ảnh được load với selector "img.sFlh5c"
  await page
    .waitForSelector('img.sFlh5c.FyHeAf.iPVvYb', { timeout: 5000 })
    .catch(() => null);

  // Lấy đường dẫn của hình ảnh dialog
  const dialogImageElement = await page.$('img.sFlh5c.FyHeAf.iPVvYb');
  const firstImage = dialogImageElement
    ? await dialogImageElement.evaluate((img) => img.src)
    : null;

  // Đóng trình duyệt và trả về kết quả
  await browser.close();
  return firstImage;
};

export { fetchFirstImageUrl, fetchSecondImageUrl };
