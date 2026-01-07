# VNPay Integration Setup Guide

This guide will help you set up VNPay payment integration.

## Table of Contents

1. [Create VNPay Sandbox Account](#1-create-vnpay-sandbox-account)
2. [Get Credentials](#2-get-credentials)
3. [Configure Environment Variables](#3-configure-environment-variables)
4. [Setup IPN for Local Development](#4-setup-ipn-for-local-development)
5. [Configure IPN URL in VNPay Portal](#5-configure-ipn-url-in-vnpay-portal)
6. [Testing](#6-testing)

---

## 1. Create VNPay Sandbox Account

1. Visit the VNPay Sandbox Portal: https://sandbox.vnpayment.vn/
2. Click on **"Đăng ký"** (Register) or **"Đăng nhập"** (Login) if you already have an account
3. Fill in the registration form with your business information
4. Verify your email address
5. Complete the merchant registration process

## 2. Get Credentials

After logging into the VNPay Sandbox Portal:

1. Navigate to **"Thông tin kết nối"** (Connection Information) or **"Cấu hình"** (Configuration)
2. You will find the following information:
   - **Terminal ID (TMN Code)**: Your merchant terminal code
   - **Secret Key (Hash Secret)**: Your secure hash secret for signature generation
   - **API URL**: Usually `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` for sandbox

## 3. Configure Environment Variables

Add the following environment variables to your `.env` file in the backend root directory:

```env
# VNPay Configuration
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_TMN_CODE=your_tmn_code_here
VNPAY_HASH_SECRET=your_hash_secret_here

# Base URL for IPN callback
BASE_URL=http://localhost:2808

```

**Important Notes:**
- Replace `your_tmn_code_here` with your actual Terminal ID from VNPay portal
- Replace `your_hash_secret_here` with your actual Secret Key from VNPay portal
- For production, change `VNPAY_URL` to the production URL: `https://www.vnpayment.vn/paymentv2/vpcpay.html`

## 4. Setup IPN for Local Development

Since VNPay needs to send IPN (Instant Payment Notification) callbacks to your backend, and your local server is not accessible from the internet, you need to use a tunneling tool like **ngrok**.

### 4.1 Install ngrok on macOS

#### Option 1: Using Homebrew (Recommended)

# Install ngrok
brew install ngrok
```

#### Option 2: Using Direct Download

1. Visit https://ngrok.com/download
2. Download the macOS version
3. Extract the zip file
4. Move `ngrok` to `/usr/local/bin/` or add it to your PATH:
   ```bash
   sudo mv ngrok /usr/local/bin/
   ```

### 4.2 Create ngrok Account and Get Auth Token

1. Sign up for a free account at https://dashboard.ngrok.com/signup
2. After logging in, go to **"Your Authtoken"** section
3. Copy your authtoken

### 4.3 Configure ngrok

```bash
# Login with your authtoken
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

Replace `YOUR_AUTHTOKEN_HERE` with your actual authtoken from ngrok dashboard.

### 4.4 Start ngrok Tunnel

Make sure your backend server is running on port 2808, then start ngrok:

```bash
# Start ngrok tunnel pointing to your backend
ngrok http 2808
```

You will see output like:
```
Session Status                online
Account                       Your Account (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:2808
```

**Important:** Copy the `Forwarding` URL (e.g., `https://abc123.ngrok-free.app`). This is your public domain that VNPay will use to send IPN callbacks.


**Note:** If you restart ngrok, you'll get a new URL. You'll need to update both `.env` and the IPN URL in VNPay portal.

## 5. Configure IPN URL in VNPay Portal

1. Log into VNPay Sandbox Portal: https://sandbox.vnpayment.vn/
2. Navigate to **"Cấu hình"** (Configuration) or **"Thông tin kết nối"** (Connection Information)
3. Click any website record find the **"IPN URL"** or **"Callback URL"** field
4. Click on the IPN URL field and enter your callback URL:
   
   ![VNPay IPN Configuration Step 5](https://vnpay.js.org/assets/images/ipn-step-2-d284dd3d791ac73290acd1040f9439c5.png)

   Click any record
   

   ![VNPay IPN Configuration Step 5](https://vnpay.js.org/assets/images/ipn-step-5-af3c27ef3f2e8e5ccbacbbc79c3c0c08.png)
   
   Example:
   ```
   https://abc123.ngrok-free.app/payment/callback/vnpay
   ```
5. Save the configuration

**Important Notes:**
- The IPN URL must be accessible from the internet (hence ngrok)
- The URL must use HTTPS (ngrok provides this automatically)
- The endpoint `/payment/callback/vnpay` is already implemented in the backend
- If your ngrok URL changes, update it in both `.env` and VNPay portal

## 6. Testing

### 6.1 Start Your Backend Server

**Note:** You must run migration for latest updating payment entity

```bash
cd movie-website-backend
npm run dev
```

### 6.2 Start ngrok Tunnel

In a separate terminal:

```bash
ngrok http 2808
```

### 6.3 Banking Account Test

```bash

Ngân hàng:	NCB
Số thẻ:	9704198526191432198
Tên chủ thẻ:	NGUYEN VAN A
Ngày phát hành:	07/15
Mật khẩu OTP:	123456
```
