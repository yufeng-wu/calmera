Pod::Spec.new do |s|
  s.name = 'CalmeraChatGPT'
  s.version = '0.1.0'
  s.summary = 'Calmera local ChatGPT authorization'
  s.description = 'Loopback-only OAuth, signed identity validation and selected-photo input.'
  s.author = 'Calmera'
  s.license = 'UNLICENSED'
  s.homepage = 'https://developers.openai.com/siwc/token-sharing-open-source'
  s.source = { :git => '' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Network', 'CryptoKit', 'Security', 'PhotosUI', 'AVFoundation'
  s.source_files = '**/*.swift'
end
