package cloudinary

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Config contains Cloudinary configuration
type Config struct {
	CloudName string
	APIKey    string
	APISecret string
}

// Client represents a Cloudinary client
type Client struct {
	cfg        Config
	httpClient *http.Client
}

// UploadResult contains the result of a Cloudinary upload
type UploadResult struct {
	PublicID  string `json:"public_id"`
	SecureURL string `json:"secure_url"`
	Format    string `json:"format"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
}

// DestroyResult contains the result of a Cloudinary delete
type DestroyResult struct {
	Result string `json:"result"`
}

// NewClient creates a new Cloudinary client
func NewClient(cfg Config) *Client {
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// IsConfigured returns true if all required credentials are set
func (c *Client) IsConfigured() bool {
	return c.cfg.CloudName != "" && c.cfg.APIKey != "" && c.cfg.APISecret != ""
}

// UploadMedia uploads an image or animated GIF to Cloudinary
func (c *Client) UploadMedia(ctx context.Context, data []byte, filename, folder string) (*UploadResult, error) {
	if !c.IsConfigured() {
		return nil, errors.New("cloudinary is not configured: missing credentials")
	}

	uploadURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", c.cfg.CloudName)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	// Prepare signature params
	params := map[string]string{
		"timestamp": timestamp,
	}
	if folder != "" {
		params["folder"] = folder
	}

	sig := c.generateSignature(params)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add fields
	for k, v := range params {
		if err := writer.WriteField(k, v); err != nil {
			return nil, err
		}
	}
	if err := writer.WriteField("api_key", c.cfg.APIKey); err != nil {
		return nil, err
	}
	if err := writer.WriteField("signature", sig); err != nil {
		return nil, err
	}

	// Add file
	if filename == "" {
		filename = "upload.png"
	}
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(part, bytes.NewReader(data)); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cloudinary request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read cloudinary response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("cloudinary upload error (status %d): %s", resp.StatusCode, string(respBytes))
	}

	var result UploadResult
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse cloudinary upload response: %w", err)
	}

	return &result, nil
}

// DeleteMedia deletes an asset from Cloudinary by its public ID
func (c *Client) DeleteMedia(ctx context.Context, publicID string) error {
	if publicID == "" || !c.IsConfigured() {
		return nil
	}

	destroyURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/destroy", c.cfg.CloudName)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	params := map[string]string{
		"public_id": publicID,
		"timestamp": timestamp,
	}

	sig := c.generateSignature(params)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	for k, v := range params {
		if err := writer.WriteField(k, v); err != nil {
			return err
		}
	}
	if err := writer.WriteField("api_key", c.cfg.APIKey); err != nil {
		return err
	}
	if err := writer.WriteField("signature", sig); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, destroyURL, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("cloudinary delete request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read cloudinary delete response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[Cloudinary] Warning: destroy returned status %d: %s", resp.StatusCode, string(respBytes))
		return nil
	}

	var result DestroyResult
	if err := json.Unmarshal(respBytes, &result); err == nil {
		log.Printf("[Cloudinary] Asset %s deleted: result=%s", publicID, result.Result)
	}

	return nil
}

// generateSignature creates an HMAC-SHA1 signature of sorted params with api_secret
func (c *Client) generateSignature(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var sb strings.Builder
	for i, k := range keys {
		if i > 0 {
			sb.WriteString("&")
		}
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(params[k])
	}
	sb.WriteString(c.cfg.APISecret)

	hasher := sha1.New()
	hasher.Write([]byte(sb.String()))
	return hex.EncodeToString(hasher.Sum(nil))
}
